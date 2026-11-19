import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { Markdown, MarkdownStorage } from "tiptap-markdown";
import { Backend, DocumentPayload } from "../core/ipc";
import {
  computeCursorLineCol,
  computeDocumentStats,
  computeHangingIndentCols,
} from "../core/markdown";
import { SaveStatus, state } from "../core/state";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const enkelHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "#dfca91", fontWeight: "600" },
  { tag: tags.processingInstruction, color: "#7daea3", fontWeight: "600" },
  { tag: tags.strong, color: "#df7c73", fontWeight: "700" },
  { tag: tags.emphasis, color: "#c4d4d0", fontStyle: "italic" },
  { tag: tags.monospace, class: "cm-md-inline-code" },
  { tag: tags.list, color: "#d49a6a", fontWeight: "600" },
  { tag: tags.quote, color: "#8f9e9b", fontStyle: "italic" },
  { tag: tags.link, color: "#8abeb7", textDecoration: "underline" },
  { tag: tags.url, color: "#6a7b77" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#6d7673" },
  { tag: tags.meta, color: "#6a7b77" },
  { tag: tags.keyword, color: "#7daea3", fontWeight: "600" },
  { tag: tags.string, color: "#b5d1a3" },
  { tag: tags.number, color: "#d6b889" },
  { tag: tags.comment, color: "#5d6d6a", fontStyle: "italic" },
  { tag: tags.function(tags.variableName), color: "#cee0dc" },
]);

const hangingIndentPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    private buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const tabSize = view.state.tabSize;
      const seenLines = new Set<number>();

      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
          const line = view.state.doc.lineAt(pos);
          if (!seenLines.has(line.from)) {
            seenLines.add(line.from);
            const cols = computeHangingIndentCols(line.text, tabSize);
            if (cols > 0) {
              builder.add(
                line.from,
                line.from,
                Decoration.line({
                  attributes: {
                    style: `padding-left: calc(6px + ${cols}ch); text-indent: -${cols}ch;`,
                  },
                })
              );
            }
          }
          if (line.to >= to) break;
          pos = line.to + 1;
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * Extended Image node that keeps the portable workspace relative path (`mdSrc`)
 * for `.md` serialization while displaying the resolved `data:` URL in the editor.
 */
const EnkelImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mdSrc: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-md-src") || el.getAttribute("src"),
        renderHTML: (attrs) => (attrs.mdSrc ? { "data-md-src": attrs.mdSrc } : {}),
      },
    };
  },
  addStorage() {
    return {
      markdown: {
        serialize(
          mdState: { write: (text: string) => void },
          node: { attrs: { mdSrc?: string; src?: string; alt?: string; title?: string } }
        ) {
          const src = node.attrs.mdSrc || node.attrs.src || "";
          const alt = (node.attrs.alt || "").replace(/[[\]]/g, "");
          const title = node.attrs.title ? ` "${node.attrs.title}"` : "";
          mdState.write(`![${alt}](${src}${title})`);
        },
        parse: {},
      },
    };
  },
});

interface SlashCommandItem {
  id: string;
  badge: string;
  title: string;
  desc: string;
  keywords: string;
  run: (editor: Editor, controller: EditorController) => void;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: "h1",
    badge: "H1",
    title: "Título 1",
    desc: "Cabeçalho principal da página",
    keywords: "titulo h1 heading cabecalho",
    run: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    badge: "H2",
    title: "Título 2",
    desc: "Título de seção",
    keywords: "titulo h2 heading secao",
    run: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    badge: "H3",
    title: "Título 3",
    desc: "Subtítulo",
    keywords: "titulo h3 heading subtitulo",
    run: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    badge: "•",
    title: "Lista com marcadores",
    desc: "Lista simples de itens",
    keywords: "lista bullet marcadores topicos ul",
    run: (ed) => ed.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered",
    badge: "1.",
    title: "Lista numerada",
    desc: "Lista ordenada passo a passo",
    keywords: "lista numerada ordenada ol",
    run: (ed) => ed.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "todo",
    badge: "☑",
    title: "Lista de tarefas",
    desc: "Checklist interativa (to-do)",
    keywords: "tarefa checklist todo checkbox",
    run: (ed) => ed.chain().focus().toggleTaskList().run(),
  },
  {
    id: "quote",
    badge: "❝",
    title: "Citação",
    desc: "Bloco de destaque ou anotação",
    keywords: "citacao quote blockquote destaque",
    run: (ed) => ed.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code",
    badge: "</>",
    title: "Bloco de código",
    desc: "Trecho de código ou comando",
    keywords: "codigo code bloco snippet",
    run: (ed) => ed.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "divider",
    badge: "—",
    title: "Divisor",
    desc: "Linha separadora horizontal",
    keywords: "divisor linha separador hr",
    run: (ed) => ed.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "image",
    badge: "IMG",
    title: "Imagem",
    desc: "Enviar imagem do computador",
    keywords: "imagem foto upload picture",
    run: (_ed, ctrl) => ctrl.openImagePicker(),
  },
];

export class EditorController {
  private emptyStateEl: HTMLElement;
  private writingSurfaceEl: HTMLElement;
  private notionHostEl: HTMLElement;
  private cmHostEl: HTMLElement;
  private slashMenuEl: HTMLElement;
  private selectionToolbarEl: HTMLElement;
  private breadcrumbEl: HTMLElement;
  private saveIndicatorEl: HTMLElement;
  private saveTextEl: HTMLElement;
  private cursorPosEl: HTMLElement;
  private statsEl: HTMLElement;
  private modeToggleBtn: HTMLButtonElement;
  private modeToggleLabel: HTMLElement;
  private imageFileInput: HTMLInputElement;

  private notionEditor: Editor | null = null;
  private cmView: EditorView | null = null;
  private suppressUpdate = false;

  // Slash menu state
  private slashActive = false;
  private slashRange: { from: number; to: number } | null = null;
  private slashFiltered: SlashCommandItem[] = [];
  private slashSelectedIdx = 0;

  // In-document Find bar elements
  private findBarEl: HTMLElement;
  private findInputEl: HTMLInputElement;
  private findCountEl: HTMLElement;
  private findMatches: Array<{ from: number; to: number }> = [];
  private findCurrentIdx = -1;

  private debounceTimer: number | null = null;
  private readonly AUTOSAVE_DELAY_MS = 450;

  constructor() {
    this.emptyStateEl = document.getElementById("empty-state")!;
    this.writingSurfaceEl = document.getElementById("writing-surface")!;
    this.notionHostEl = document.getElementById("notion-editor-host")!;
    this.cmHostEl = document.getElementById("codemirror-host")!;
    this.slashMenuEl = document.getElementById("slash-menu")!;
    this.selectionToolbarEl = document.getElementById("selection-toolbar")!;
    this.breadcrumbEl = document.getElementById("doc-breadcrumb")!;
    this.saveIndicatorEl = document.getElementById("save-indicator")!;
    this.saveTextEl = document.getElementById("save-text")!;
    this.cursorPosEl = document.getElementById("cursor-pos")!;
    this.statsEl = document.getElementById("doc-stats")!;
    this.modeToggleBtn = document.getElementById("btn-toggle-preview") as HTMLButtonElement;
    this.modeToggleLabel = document.getElementById("preview-toggle-label")!;
    this.imageFileInput = document.getElementById("image-file-input") as HTMLInputElement;

    this.findBarEl = document.getElementById("find-bar")!;
    this.findInputEl = document.getElementById("find-input") as HTMLInputElement;
    this.findCountEl = document.getElementById("find-count")!;

    this.initNotionEditor();
    this.initCodeMirror();
    this.bindEvents();
  }

  private getNotionMarkdown(): string {
    if (!this.notionEditor) return state.currentContent;
    const storage = this.notionEditor.storage as unknown as { markdown?: MarkdownStorage };
    return storage.markdown?.getMarkdown() ?? "";
  }

  private initNotionEditor(): void {
    this.notionEditor = new Editor({
      element: this.notionHostEl,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          link: false,
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        EnkelImage.configure({
          inline: false,
          allowBase64: true,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
        }),
        Placeholder.configure({
          placeholder: ({ node }) =>
            node.type.name === "heading"
              ? "Título"
              : "Escreva algo ou digite '/' para comandos...",
        }),
        Markdown.configure({
          html: false,
          tightLists: true,
          bulletListMarker: "-",
          linkify: true,
          breaks: false,
          transformPastedText: true,
          transformCopiedText: true,
        }),
      ],
      editorProps: {
        attributes: {
          spellcheck: "false",
          autocorrect: "off",
          autocapitalize: "off",
        },
        handleKeyDown: (_view, event) => this.handleNotionKeyDown(event),
        handlePaste: (_view, event) => {
          if (event.clipboardData) {
            const hasImage = Array.from(event.clipboardData.items).some((item) =>
              item.type.startsWith("image/")
            );
            if (hasImage) {
              void this.handlePaste(event);
              return true;
            }
          }
          return false;
        },
      },
      onUpdate: () => {
        if (this.suppressUpdate || state.rawMarkdownMode) return;
        state.currentContent = this.getNotionMarkdown();
        this.updateStats();
        this.updateNotionCursorStatus();
        this.setSaveStatus("dirty");
        this.scheduleAutosave();
        this.evaluateSlashTrigger();
      },
      onSelectionUpdate: () => {
        if (this.suppressUpdate || state.rawMarkdownMode) return;
        this.updateNotionCursorStatus();
        this.updateSelectionToolbar();
        this.evaluateSlashTrigger();
      },
      onBlur: () => {
        window.setTimeout(() => {
          if (!this.selectionToolbarEl.contains(document.activeElement)) {
            this.hideSelectionToolbar();
          }
          if (!this.slashMenuEl.contains(document.activeElement)) {
            this.closeSlashMenu();
          }
        }, 120);
      },
    });
  }

  private handleNotionKeyDown(event: KeyboardEvent): boolean {
    if (this.slashActive) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (this.slashFiltered.length > 0) {
          this.slashSelectedIdx = (this.slashSelectedIdx + 1) % this.slashFiltered.length;
          this.renderSlashMenu();
        }
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (this.slashFiltered.length > 0) {
          this.slashSelectedIdx =
            (this.slashSelectedIdx - 1 + this.slashFiltered.length) % this.slashFiltered.length;
          this.renderSlashMenu();
        }
        return true;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const chosen = this.slashFiltered[this.slashSelectedIdx];
        if (chosen) {
          this.executeSlashCommand(chosen);
        } else {
          this.closeSlashMenu();
        }
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeSlashMenu();
        return true;
      }
    }

    return false;
  }

  private evaluateSlashTrigger(): void {
    if (!this.notionEditor || state.rawMarkdownMode) {
      this.closeSlashMenu();
      return;
    }

    const { selection } = this.notionEditor.state;
    if (!selection.empty) {
      this.closeSlashMenu();
      return;
    }

    const { $from } = selection;
    if ($from.parent.type.name === "codeBlock") {
      this.closeSlashMenu();
      return;
    }

    const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\n", "\0");
    const match = textBefore.match(/(?:^|\s)\/([^\s/]*)$/);
    if (!match) {
      this.closeSlashMenu();
      return;
    }

    const query = match[1].toLowerCase();
    const slashOffsetInParent = textBefore.lastIndexOf("/");
    const from = $from.start() + slashOffsetInParent;
    const to = $from.pos;

    this.slashFiltered = SLASH_COMMANDS.filter((item) => {
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.keywords.includes(query) ||
        item.badge.toLowerCase().includes(query)
      );
    });

    if (this.slashFiltered.length === 0) {
      this.closeSlashMenu();
      return;
    }

    this.slashActive = true;
    this.slashRange = { from, to };
    this.slashSelectedIdx = Math.min(this.slashSelectedIdx, this.slashFiltered.length - 1);
    this.renderSlashMenu();
    this.positionSlashMenu(to);
  }

  private renderSlashMenu(): void {
    this.slashMenuEl.innerHTML = "";
    this.slashFiltered.forEach((item, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `slash-menu-item${index === this.slashSelectedIdx ? " is-selected" : ""}`;
      btn.innerHTML = `
        <span class="slash-menu-badge">${item.badge}</span>
        <span class="slash-menu-text">
          <span class="slash-menu-title">${item.title}</span>
          <span class="slash-menu-desc">${item.desc}</span>
        </span>
      `;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.executeSlashCommand(item);
      });
      this.slashMenuEl.appendChild(btn);
    });

    const selectedEl = this.slashMenuEl.children[this.slashSelectedIdx] as HTMLElement | undefined;
    selectedEl?.scrollIntoView({ block: "nearest" });
  }

  private positionSlashMenu(pos: number): void {
    if (!this.notionEditor) return;
    const coords = this.notionEditor.view.coordsAtPos(pos);
    this.slashMenuEl.classList.remove("hidden");

    const menuHeight = Math.min(320, this.slashMenuEl.scrollHeight || 260);
    const spaceBelow = window.innerHeight - coords.bottom;
    const top =
      spaceBelow >= menuHeight + 16
        ? coords.bottom + 6
        : Math.max(12, coords.top - menuHeight - 6);
    const left = Math.min(coords.left, Math.max(12, window.innerWidth - 284));

    this.slashMenuEl.style.top = `${top}px`;
    this.slashMenuEl.style.left = `${left}px`;
  }

  private executeSlashCommand(item: SlashCommandItem): void {
    if (!this.notionEditor) return;
    const range = this.slashRange;
    this.closeSlashMenu();

    if (range) {
      this.notionEditor.chain().focus().deleteRange(range).run();
    }
    item.run(this.notionEditor, this);
  }

  private closeSlashMenu(): void {
    if (!this.slashActive) return;
    this.slashActive = false;
    this.slashRange = null;
    this.slashSelectedIdx = 0;
    this.slashMenuEl.classList.add("hidden");
  }

  private updateSelectionToolbar(): void {
    if (!this.notionEditor || state.rawMarkdownMode) {
      this.hideSelectionToolbar();
      return;
    }

    const { selection } = this.notionEditor.state;
    if (selection.empty) {
      this.hideSelectionToolbar();
      return;
    }

    const { from, to } = selection;
    const start = this.notionEditor.view.coordsAtPos(from);
    const end = this.notionEditor.view.coordsAtPos(to);
    const centerX = (start.left + end.right) / 2;

    this.selectionToolbarEl.classList.remove("hidden");
    const toolbarWidth = this.selectionToolbarEl.offsetWidth || 210;
    const left = Math.max(12, Math.min(centerX - toolbarWidth / 2, window.innerWidth - toolbarWidth - 12));
    const top = Math.max(48, start.top - 42);

    this.selectionToolbarEl.style.left = `${left}px`;
    this.selectionToolbarEl.style.top = `${top}px`;

    const marks = ["bold", "italic", "strike", "code", "link"] as const;
    for (const mark of marks) {
      const btn = this.selectionToolbarEl.querySelector<HTMLButtonElement>(`[data-mark="${mark}"]`);
      btn?.classList.toggle("is-active", this.notionEditor.isActive(mark));
    }
  }

  private hideSelectionToolbar(): void {
    this.selectionToolbarEl.classList.add("hidden");
  }

  private initCodeMirror(): void {
    const customKeymap = keymap.of([
      {
        key: "Tab",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) {
            return indentMore(view);
          }
          const line = view.state.doc.lineAt(sel.head);
          if (/^\s*(?:[-*+]|\d+\.)\s/.test(line.text)) {
            return indentMore(view);
          }
          view.dispatch(
            view.state.update({
              changes: { from: sel.from, to: sel.to, insert: "  " },
              selection: { anchor: sel.from + 2 },
            })
          );
          return true;
        },
      },
      {
        key: "Shift-Tab",
        run: indentLess,
      },
      {
        key: "Enter",
        run: (view) => this.handleSmartEnter(view),
      },
      {
        key: "Mod-b",
        run: (view) => this.wrapSelection(view, "**", "**"),
      },
      {
        key: "Mod-i",
        run: (view) => this.wrapSelection(view, "*", "*"),
      },
    ]);

    const cmState = EditorState.create({
      doc: "",
      extensions: this.buildExtensions(customKeymap),
    });

    this.cmView = new EditorView({
      state: cmState,
      parent: this.cmHostEl,
    });
  }

  private buildExtensions(customKeymap: ReturnType<typeof keymap.of>) {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      indentUnit.of("  "),
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      hangingIndentPlugin,
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(enkelHighlightStyle),
      cmPlaceholder("Comece a escrever em Markdown..."),
      EditorView.contentAttributes.of({
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
      }),
      customKeymap,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.domEventHandlers({
        paste: (event) => {
          void this.handlePaste(event);
          return false;
        },
      }),
      EditorView.updateListener.of((update) => {
        if (this.suppressUpdate || !state.rawMarkdownMode) return;
        if (update.docChanged) {
          state.currentContent = update.state.doc.toString();
          this.updateStats();
          this.setSaveStatus("dirty");
          this.scheduleAutosave();
        }
        if (update.selectionSet || update.docChanged) {
          this.updateCursorPosition(
            update.state.doc.toString(),
            update.state.selection.main.head
          );
        }
      }),
    ];
  }

  private handleSmartEnter(view: EditorView): boolean {
    const sel = view.state.selection.main;
    if (!sel.empty) return false;

    const line = view.state.doc.lineAt(sel.head);
    const beforeCursor = line.text.slice(0, sel.head - line.from);

    const taskMatch = beforeCursor.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
    if (taskMatch) {
      if (taskMatch[2].trim() === "" && sel.head === line.to) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: "" } });
      } else {
        const prefix = taskMatch[1].replace(/\[[xX]\]/, "[ ]");
        view.dispatch({
          changes: { from: sel.head, insert: `\n${prefix}` },
          selection: { anchor: sel.head + 1 + prefix.length },
        });
      }
      return true;
    }

    const bulletMatch = beforeCursor.match(/^(\s*[-*+]\s+)(.*)$/);
    if (bulletMatch) {
      if (bulletMatch[2].trim() === "" && sel.head === line.to) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: "" } });
      } else {
        const prefix = bulletMatch[1];
        view.dispatch({
          changes: { from: sel.head, insert: `\n${prefix}` },
          selection: { anchor: sel.head + 1 + prefix.length },
        });
      }
      return true;
    }

    const numMatch = beforeCursor.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numMatch) {
      if (numMatch[3].trim() === "" && sel.head === line.to) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: "" } });
      } else {
        const nextNum = parseInt(numMatch[2], 10) + 1;
        const prefix = `${numMatch[1]}${nextNum}. `;
        view.dispatch({
          changes: { from: sel.head, insert: `\n${prefix}` },
          selection: { anchor: sel.head + 1 + prefix.length },
        });
      }
      return true;
    }

    const quoteMatch = beforeCursor.match(/^(\s*>\s+)(.*)$/);
    if (quoteMatch) {
      if (quoteMatch[2].trim() === "" && sel.head === line.to) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: "" } });
      } else {
        const prefix = quoteMatch[1];
        view.dispatch({
          changes: { from: sel.head, insert: `\n${prefix}` },
          selection: { anchor: sel.head + 1 + prefix.length },
        });
      }
      return true;
    }

    const indentMatch = beforeCursor.match(/^(\s+)/);
    if (indentMatch) {
      const indent = indentMatch[1];
      view.dispatch({
        changes: { from: sel.head, insert: `\n${indent}` },
        selection: { anchor: sel.head + 1 + indent.length },
      });
      return true;
    }

    return false;
  }

  private wrapSelection(view: EditorView, left: string, right: string): boolean {
    const sel = view.state.selection.main;
    const selected = view.state.sliceDoc(sel.from, sel.to);
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: `${left}${selected}${right}` },
      selection: sel.empty
        ? { anchor: sel.from + left.length }
        : { anchor: sel.from + left.length, head: sel.to + left.length },
    });
    return true;
  }

  private bindEvents(): void {
    this.modeToggleBtn.addEventListener("click", () => {
      this.toggleRawMarkdownMode();
    });

    document.getElementById("btn-insert-image")?.addEventListener("click", () => {
      this.openImagePicker();
    });

    this.imageFileInput.addEventListener("change", () => {
      const file = this.imageFileInput.files?.[0];
      if (file) {
        void this.insertImageFile(file);
      }
      this.imageFileInput.value = "";
    });

    // Selection toolbar buttons
    this.selectionToolbarEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-mark]");
      if (!target || !this.notionEditor) return;
      const mark = target.dataset.mark;
      switch (mark) {
        case "bold":
          this.notionEditor.chain().focus().toggleBold().run();
          break;
        case "italic":
          this.notionEditor.chain().focus().toggleItalic().run();
          break;
        case "strike":
          this.notionEditor.chain().focus().toggleStrike().run();
          break;
        case "code":
          this.notionEditor.chain().focus().toggleCode().run();
          break;
        case "link": {
          if (this.notionEditor.isActive("link")) {
            this.notionEditor.chain().focus().unsetLink().run();
          } else {
            const url = window.prompt("URL do link:", "https://");
            if (url && url.trim()) {
              this.notionEditor.chain().focus().setLink({ href: url.trim() }).run();
            }
          }
          break;
        }
      }
      this.updateSelectionToolbar();
    });

    // Clicking empty area in notionHostEl focuses editor at the end
    this.notionHostEl.addEventListener("mousedown", (e) => {
      if (e.target === this.notionHostEl && this.notionEditor) {
        e.preventDefault();
        this.notionEditor.commands.focus("end");
      }
    });

    // Find in document (Ctrl+F)
    document.getElementById("btn-find-in-doc")?.addEventListener("click", () => {
      this.openFindBar();
    });
    document.getElementById("btn-find-close")?.addEventListener("click", () => {
      this.closeFindBar();
    });
    document.getElementById("btn-find-prev")?.addEventListener("click", () => {
      this.stepFindMatch(-1);
    });
    document.getElementById("btn-find-next")?.addEventListener("click", () => {
      this.stepFindMatch(1);
    });

    this.findInputEl.addEventListener("input", () => {
      this.computeFindMatches();
      if (this.findMatches.length > 0) {
        this.stepFindMatch(1, true);
      }
    });

    this.findInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.closeFindBar();
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.stepFindMatch(e.shiftKey ? -1 : 1, true);
      }
    });
  }

  public openImagePicker(): void {
    if (!state.activeDoc) return;
    this.imageFileInput.click();
  }

  public async loadDocument(doc: DocumentPayload | null): Promise<void> {
    await this.flushSave();
    this.closeSlashMenu();
    this.hideSelectionToolbar();

    state.activeDoc = doc;
    if (!doc) {
      state.currentContent = "";
      this.emptyStateEl.classList.remove("hidden");
      this.writingSurfaceEl.classList.add("hidden");
      this.breadcrumbEl.textContent = "Nenhum documento aberto";
      this.setSaveStatus("saved");
      this.updateStats();
      this.updateCursorPosition("", 0);
      this.findBarEl.classList.add("hidden");
      return;
    }

    state.currentContent = doc.content;
    this.emptyStateEl.classList.add("hidden");
    this.writingSurfaceEl.classList.remove("hidden");
    this.breadcrumbEl.textContent = doc.relPath;
    this.setSaveStatus("saved");
    this.updateStats();

    this.setCodeMirrorContent(doc.content);
    this.setNotionContent(doc.content);
    await this.resolveNotionWorkspaceImages(doc.relPath);

    if (state.rawMarkdownMode) {
      this.updateCursorPosition(doc.content, 0);
    } else {
      this.updateNotionCursorStatus();
    }

    this.focusEditorImmediately();
  }

  private setNotionContent(content: string): void {
    if (!this.notionEditor) return;
    this.suppressUpdate = true;
    try {
      this.notionEditor.commands.setContent(content);
    } finally {
      this.suppressUpdate = false;
    }
  }

  private async resolveNotionWorkspaceImages(docRelPath: string): Promise<void> {
    if (!this.notionEditor) return;
    const { state: edState } = this.notionEditor;
    const targets: Array<{ pos: number; rawSrc: string }> = [];

    edState.doc.descendants((node, pos) => {
      if (node.type.name === "image") {
        const rawSrc = (node.attrs.mdSrc as string) || (node.attrs.src as string) || "";
        if (rawSrc && !rawSrc.startsWith("data:") && !/^https?:\/\//i.test(rawSrc)) {
          targets.push({ pos, rawSrc });
        }
      }
    });

    if (targets.length === 0) return;

    const resolved = await Promise.all(
      targets.map(async (item) => {
        try {
          const dataUrl = await Backend.resolveWorkspaceImage(docRelPath, item.rawSrc);
          return { ...item, dataUrl };
        } catch {
          return null;
        }
      })
    );

    if (!state.activeDoc || state.activeDoc.relPath !== docRelPath || !this.notionEditor) return;

    this.suppressUpdate = true;
    try {
      const tr = this.notionEditor.state.tr;
      let changed = false;
      for (const item of resolved) {
        if (!item) continue;
        const node = tr.doc.nodeAt(item.pos);
        if (node && node.type.name === "image") {
          tr.setNodeMarkup(item.pos, undefined, {
            ...node.attrs,
            src: item.dataUrl,
            mdSrc: item.rawSrc,
          });
          changed = true;
        }
      }
      if (changed) {
        this.notionEditor.view.dispatch(tr);
      }
    } finally {
      this.suppressUpdate = false;
    }
  }

  private setCodeMirrorContent(content: string): void {
    if (!this.cmView) return;
    this.suppressUpdate = true;
    try {
      const customKeymap = keymap.of([
        {
          key: "Tab",
          run: (view) => {
            const sel = view.state.selection.main;
            if (!sel.empty) return indentMore(view);
            const line = view.state.doc.lineAt(sel.head);
            if (/^\s*(?:[-*+]|\d+\.)\s/.test(line.text)) return indentMore(view);
            view.dispatch(
              view.state.update({
                changes: { from: sel.from, to: sel.to, insert: "  " },
                selection: { anchor: sel.from + 2 },
              })
            );
            return true;
          },
        },
        { key: "Shift-Tab", run: indentLess },
        { key: "Enter", run: (view) => this.handleSmartEnter(view) },
        { key: "Mod-b", run: (view) => this.wrapSelection(view, "**", "**") },
        { key: "Mod-i", run: (view) => this.wrapSelection(view, "*", "*") },
      ]);

      this.cmView.setState(
        EditorState.create({
          doc: content,
          extensions: this.buildExtensions(customKeymap),
        })
      );
    } finally {
      this.suppressUpdate = false;
    }
  }

  public focusEditorImmediately(): void {
    if (!state.activeDoc) return;
    requestAnimationFrame(() => {
      if (state.rawMarkdownMode) {
        this.cmView?.focus();
      } else {
        this.notionEditor?.commands.focus();
      }
    });
  }

  public toggleRawMarkdownMode(force?: boolean): void {
    if (!state.activeDoc) return;
    const nextRaw = force !== undefined ? force : !state.rawMarkdownMode;
    if (nextRaw === state.rawMarkdownMode) return;

    this.closeSlashMenu();
    this.hideSelectionToolbar();

    state.rawMarkdownMode = nextRaw;
    this.modeToggleBtn.setAttribute("aria-pressed", String(nextRaw));
    this.modeToggleLabel.textContent = "raw";

    if (nextRaw) {
      // Sync latest Markdown from Notion editor into CodeMirror
      state.currentContent = this.getNotionMarkdown();
      this.setCodeMirrorContent(state.currentContent);
      this.notionHostEl.classList.add("hidden");
      this.cmHostEl.classList.remove("hidden");
      this.updateCursorPosition(state.currentContent, 0);
    } else {
      // Sync latest Markdown from CodeMirror into Notion editor
      if (this.cmView) {
        state.currentContent = this.cmView.state.doc.toString();
      }
      this.setNotionContent(state.currentContent);
      void this.resolveNotionWorkspaceImages(state.activeDoc.relPath);
      this.cmHostEl.classList.add("hidden");
      this.notionHostEl.classList.remove("hidden");
      this.updateNotionCursorStatus();
    }

    this.focusEditorImmediately();
  }

  private scheduleAutosave(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.flushSave();
    }, this.AUTOSAVE_DELAY_MS);
  }

  public async flushSave(): Promise<void> {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!state.activeDoc || state.saveStatus !== "dirty") {
      return;
    }

    const targetRelPath = state.activeDoc.relPath;
    const contentToSave = state.rawMarkdownMode
      ? this.cmView?.state.doc.toString() ?? state.currentContent
      : this.getNotionMarkdown();
    state.currentContent = contentToSave;
    this.setSaveStatus("saving");

    try {
      const res = await Backend.saveDocument(targetRelPath, contentToSave);
      if (state.activeDoc && state.activeDoc.relPath === targetRelPath) {
        state.activeDoc.content = contentToSave;
        state.activeDoc.updatedAt = res.updatedAt;
        if (state.currentContent === contentToSave) {
          this.setSaveStatus("saved");
        } else {
          this.setSaveStatus("dirty");
          this.scheduleAutosave();
        }
      }
    } catch (err) {
      console.error("Falha ao salvar documento:", err);
      this.setSaveStatus("error");
    }
  }

  private setSaveStatus(status: SaveStatus): void {
    state.saveStatus = status;
    this.saveIndicatorEl.dataset.state = status;
    if (!state.activeDoc) {
      this.saveTextEl.textContent = "Pronto";
      return;
    }
    switch (status) {
      case "saved":
        this.saveTextEl.textContent = "Salvo";
        break;
      case "dirty":
        this.saveTextEl.textContent = "Alterações pendentes";
        break;
      case "saving":
        this.saveTextEl.textContent = "Salvando...";
        break;
      case "error":
        this.saveTextEl.textContent = "Erro ao salvar";
        break;
    }
  }

  private updateStats(): void {
    if (!state.activeDoc) {
      this.statsEl.textContent = "0 palavras · 0 caracteres";
      return;
    }
    const { words, chars } = computeDocumentStats(state.currentContent);
    this.statsEl.textContent = `${words} ${words === 1 ? "palavra" : "palavras"} · ${chars} ${
      chars === 1 ? "caractere" : "caracteres"
    }`;
  }

  private updateCursorPosition(content: string, offset: number): void {
    if (!state.activeDoc) {
      this.cursorPosEl.textContent = "Ln 1, Col 1";
      return;
    }
    const { line, col } = computeCursorLineCol(content, offset);
    this.cursorPosEl.textContent = `Ln ${line}, Col ${col}`;
  }

  private updateNotionCursorStatus(): void {
    if (!state.activeDoc || !this.notionEditor) {
      this.cursorPosEl.textContent = "Ln 1, Col 1";
      return;
    }
    const { selection, doc } = this.notionEditor.state;
    const textBefore = doc.textBetween(0, selection.head, "\n", "");
    const lines = textBefore.split("\n");
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    this.cursorPosEl.textContent = `Ln ${line}, Col ${col}`;
  }

  private async handlePaste(e: ClipboardEvent): Promise<void> {
    if (!state.activeDoc || !e.clipboardData) return;

    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    e.preventDefault();
    await this.insertImageFile(file);
  }

  private async insertImageFile(file: File): Promise<void> {
    if (!state.activeDoc) return;
    try {
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const ext =
        file.name && file.name.includes(".")
          ? file.name
          : `clipboard.${file.type.split("/")[1] || "png"}`;
      const asset = await Backend.saveImageFromBytes(ext, base64);
      const altName = file.name ? file.name.replace(/\.[^.]+$/, "") : "Imagem";

      if (state.rawMarkdownMode && this.cmView) {
        const markdownSnippet = `![${altName}](${asset.relMarkdownPath})`;
        const sel = this.cmView.state.selection.main;
        this.cmView.dispatch({
          changes: { from: sel.from, to: sel.to, insert: markdownSnippet },
          selection: { anchor: sel.from + markdownSnippet.length },
        });
      } else if (this.notionEditor) {
        let displaySrc = asset.relMarkdownPath;
        try {
          displaySrc = await Backend.resolveWorkspaceImage(
            state.activeDoc.relPath,
            asset.relMarkdownPath
          );
        } catch {
          // fallback to relative path
        }
        this.notionEditor
          .chain()
          .focus()
          .insertContent({
            type: "image",
            attrs: {
              src: displaySrc,
              mdSrc: asset.relMarkdownPath,
              alt: altName,
            },
          })
          .run();
        state.currentContent = this.getNotionMarkdown();
        this.setSaveStatus("dirty");
      }

      await this.flushSave();
    } catch (err) {
      console.error("Erro ao salvar imagem:", err);
    }
  }

  // In-document Find (Ctrl+F)
  public openFindBar(): void {
    if (!state.activeDoc) return;
    this.findBarEl.classList.remove("hidden");

    if (state.rawMarkdownMode && this.cmView) {
      const sel = this.cmView.state.selection.main;
      const selectedText = this.cmView.state.sliceDoc(sel.from, sel.to);
      if (selectedText && !selectedText.includes("\n")) {
        this.findInputEl.value = selectedText;
      }
    } else if (this.notionEditor) {
      const { from, to, empty } = this.notionEditor.state.selection;
      if (!empty) {
        const selectedText = this.notionEditor.state.doc.textBetween(from, to, " ");
        if (selectedText && !selectedText.includes("\n")) {
          this.findInputEl.value = selectedText;
        }
      }
    }

    this.computeFindMatches();
    requestAnimationFrame(() => {
      this.findInputEl.focus();
      this.findInputEl.select();
    });
  }

  public closeFindBar(): void {
    this.findBarEl.classList.add("hidden");
    this.focusEditorImmediately();
  }

  private computeFindMatches(): void {
    const query = this.findInputEl.value.toLowerCase();
    this.findMatches = [];
    this.findCurrentIdx = -1;

    if (!query) {
      this.findCountEl.textContent = "0/0";
      return;
    }

    if (state.rawMarkdownMode && this.cmView) {
      const hay = this.cmView.state.doc.toString().toLowerCase();
      let pos = 0;
      while (pos <= hay.length - query.length) {
        const idx = hay.indexOf(query, pos);
        if (idx === -1) break;
        this.findMatches.push({ from: idx, to: idx + query.length });
        pos = idx + Math.max(1, query.length);
      }
    } else if (this.notionEditor) {
      this.notionEditor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const textLower = node.text.toLowerCase();
          let offset = 0;
          while (offset <= textLower.length - query.length) {
            const idx = textLower.indexOf(query, offset);
            if (idx === -1) break;
            this.findMatches.push({ from: pos + idx, to: pos + idx + query.length });
            offset = idx + Math.max(1, query.length);
          }
        }
      });
    }

    this.findCountEl.textContent =
      this.findMatches.length > 0 ? `1/${this.findMatches.length}` : "0/0";
  }

  private stepFindMatch(delta: number, keepFocusOnInput = false): void {
    if (this.findMatches.length === 0) return;
    this.findCurrentIdx =
      (this.findCurrentIdx + delta + this.findMatches.length) % this.findMatches.length;

    const match = this.findMatches[this.findCurrentIdx];
    this.findCountEl.textContent = `${this.findCurrentIdx + 1}/${this.findMatches.length}`;

    if (state.rawMarkdownMode && this.cmView) {
      this.cmView.dispatch({
        selection: { anchor: match.from, head: match.to },
        effects: EditorView.scrollIntoView(match.from, { y: "center" }),
      });
    } else if (this.notionEditor) {
      const { state: edState, view } = this.notionEditor;
      const tr = edState.tr
        .setSelection(TextSelection.create(edState.doc, match.from, match.to))
        .scrollIntoView();
      view.dispatch(tr);
    }

    if (!keepFocusOnInput) {
      this.focusEditorImmediately();
    }
  }
}
