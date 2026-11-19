/**
 * Enkel Markdown Engine & Text Utilities
 * Lightweight, dependency-free, XSS-safe Markdown parser, syntax highlighter,
 * and document statistics helpers.
 */

export interface DocumentStats {
  words: number;
  chars: number;
  lines: number;
}

export interface CursorPosition {
  line: number;
  col: number;
}

export function computeDocumentStats(content: string): DocumentStats {
  const chars = content.length;
  const trimmed = content.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const lines = content.length === 0 ? 1 : content.split(/\r?\n/).length;
  return { words, chars, lines };
}

export function computeCursorLineCol(content: string, selectionStart: number): CursorPosition {
  const safeOffset = Math.max(0, Math.min(selectionStart, content.length));
  const before = content.slice(0, safeOffset);
  const lines = before.split("\n");
  const line = lines.length;
  const col = lines[lines.length - 1].replace(/\r$/, "").length + 1;
  return { line, col };
}

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("data:text/html")
  ) {
    return false;
  }
  return true;
}

export function highlightCode(code: string, lang: string): string {
  const escaped = escapeHtml(code);
  const normalizedLang = lang.trim().toLowerCase();
  if (
    !normalizedLang ||
    normalizedLang === "text" ||
    normalizedLang === "txt" ||
    normalizedLang === "plaintext"
  ) {
    return escaped;
  }

  const tokenRegex =
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;(?:\\.|[^&])*?&quot;|&#39;(?:\\.|[^&])*?&#39;|`(?:\\.|[^`])*?`)|\b(fn|let|mut|pub|struct|enum|impl|trait|use|mod|match|if|else|for|while|loop|return|async|await|const|var|function|class|interface|type|import|export|from|def|elif|except|try|finally|with|as|pass|yield|in|true|false|null|None|True|False|Self|self|super|where|crate)\b|\b(\d+(?:\.\d+)?)\b|\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/g;

  return escaped.replace(tokenRegex, (match, comment, str, kw, num, fnCall) => {
    if (comment) return `<span class="tok-com">${comment}</span>`;
    if (str) return `<span class="tok-str">${str}</span>`;
    if (kw) return `<span class="tok-kw">${kw}</span>`;
    if (num) return `<span class="tok-num">${num}</span>`;
    if (fnCall) return `<span class="tok-fn">${fnCall}</span>`;
    return match;
  });
}

export function parseInlineMarkdown(line: string): string {
  const codeSpans: string[] = [];
  let text = line.replace(/`([^`]+)`/g, (_m, codeContent: string) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${escapeHtml(codeContent)}</code>`);
    return `\u0000CODE${idx}\u0000`;
  });

  text = escapeHtml(text);

  // Images: ![alt](src)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, rawSrc: string) => {
    const src = rawSrc.trim();
    if (!isSafeUrl(src)) return "";
    const isExternal =
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("data:image/");
    if (isExternal) {
      return `<img src="${src}" alt="${alt}" loading="lazy" />`;
    }
    return `<img src="" data-md-src="${src}" alt="${alt}" loading="lazy" />`;
  });

  // Links: [label](href)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, rawHref: string) => {
    const href = rawHref.trim();
    if (!isSafeUrl(href)) return label;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  text = text.replace(/\b_([^_\n]+)_\b/g, "<em>$1</em>");
  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_m, idxStr: string) => {
    return codeSpans[Number(idxStr)] ?? "";
  });

  return text;
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeLines: string[] = [];

  let listType: "ul" | "ol" | null = null;
  let blockquoteLines: string[] = [];
  let paragraphLines: string[] = [];
  let tableLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      const joined = paragraphLines.map((l) => parseInlineMarkdown(l)).join("<br />");
      out.push(`<p>${joined}</p>`);
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  const flushBlockquote = () => {
    if (blockquoteLines.length > 0) {
      const inner = blockquoteLines.map((l) => `<p>${parseInlineMarkdown(l)}</p>`).join("");
      out.push(`<blockquote>${inner}</blockquote>`);
      blockquoteLines = [];
    }
  };

  const flushTable = () => {
    if (tableLines.length >= 2) {
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());

      const headers = parseRow(tableLines[0]);
      const sepRow = parseRow(tableLines[1]);
      const isSeparator = sepRow.every((cell) => /^:?-{3,}:?$/.test(cell));

      if (isSeparator) {
        const thead = `<thead><tr>${headers
          .map((h) => `<th>${parseInlineMarkdown(h)}</th>`)
          .join("")}</tr></thead>`;
        const bodyRows = tableLines
          .slice(2)
          .map((rowStr) => {
            const cols = parseRow(rowStr);
            return `<tr>${cols.map((c) => `<td>${parseInlineMarkdown(c)}</td>`).join("")}</tr>`;
          })
          .join("");
        out.push(`<table>${thead}<tbody>${bodyRows}</tbody></table>`);
        tableLines = [];
        return;
      }
    }
    if (tableLines.length > 0) {
      for (const l of tableLines) {
        paragraphLines.push(l);
      }
      tableLines = [];
      flushParagraph();
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushBlockquote();
    flushTable();
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    const fenceMatch = rawLine.match(/^```(\S*)\s*$/);
    if (fenceMatch) {
      if (!inCodeBlock) {
        flushAll();
        inCodeBlock = true;
        codeBlockLang = fenceMatch[1] || "";
        codeLines = [];
      } else {
        const highlighted = highlightCode(codeLines.join("\n"), codeBlockLang);
        const langBadge = codeBlockLang
          ? `<span class="code-lang-tag">${escapeHtml(codeBlockLang)}</span>`
          : "";
        out.push(`<pre>${langBadge}<code>${highlighted}</code></pre>`);
        inCodeBlock = false;
        codeBlockLang = "";
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (rawLine.trim() === "") {
      flushAll();
      continue;
    }

    if (rawLine.trim().startsWith("|") && rawLine.trim().endsWith("|")) {
      flushParagraph();
      flushList();
      flushBlockquote();
      tableLines.push(rawLine);
      continue;
    } else if (tableLines.length > 0) {
      flushTable();
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(rawLine.trim())) {
      flushAll();
      out.push("<hr />");
      continue;
    }

    const headingMatch = rawLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length;
      const content = parseInlineMarkdown(headingMatch[2].trim());
      out.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    const quoteMatch = rawLine.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      blockquoteLines.push(quoteMatch[1]);
      continue;
    } else if (blockquoteLines.length > 0) {
      flushBlockquote();
    }

    const taskMatch = rawLine.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
        out.push("<ul>");
      }
      const checked = taskMatch[1].toLowerCase() === "x";
      const label = parseInlineMarkdown(taskMatch[2]);
      out.push(
        `<li class="task-list-item ${checked ? "checked" : ""}">` +
          `<input type="checkbox" data-line="${i}" ${checked ? "checked" : ""} />` +
          `<span>${label}</span>` +
          `</li>`
      );
      continue;
    }

    const ulMatch = rawLine.match(/^\s*[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
        out.push("<ul>");
      }
      out.push(`<li>${parseInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = rawLine.match(/^\s*\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
        out.push("<ol>");
      }
      out.push(`<li>${parseInlineMarkdown(olMatch[1])}</li>`);
      continue;
    }

    flushList();
    paragraphLines.push(rawLine);
  }

  if (inCodeBlock) {
    const highlighted = highlightCode(codeLines.join("\n"), codeBlockLang);
    out.push(`<pre><code>${highlighted}</code></pre>`);
  }

  flushAll();
  return out.join("\n");
}

/**
 * Computes the visual hanging-indent width (in monospace columns) for a line
 * so wrapped continuation lines preserve leading whitespace and list markers.
 */
export function computeHangingIndentCols(lineText: string, tabSize = 2): number {
  if (!lineText || lineText.trim().length === 0) return 0;

  let idx = 0;
  let cols = 0;
  while (idx < lineText.length) {
    const ch = lineText[idx];
    if (ch === " ") {
      cols += 1;
      idx += 1;
    } else if (ch === "\t") {
      cols += tabSize;
      idx += 1;
    } else {
      break;
    }
  }

  const rest = lineText.slice(idx);
  const listMatch = rest.match(/^(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/);
  if (listMatch) {
    cols += listMatch[0].length;
  }

  return Math.min(cols, 40);
}
