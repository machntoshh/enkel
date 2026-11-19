import { Backend, TreeNode } from "../core/ipc";
import { escapeHtml } from "../core/markdown";
import { expandParentChain, getParentFolder, state } from "../core/state";
import { DialogController } from "./dialog";
import { EditorController } from "./editor";

export class SidebarController {
  private sidebarEl: HTMLElement;
  private treeContainerEl: HTMLElement;
  private workspaceLabelEl: HTMLElement;
  private editor: EditorController;
  private dialog: DialogController;

  constructor(editor: EditorController, dialog: DialogController) {
    this.editor = editor;
    this.dialog = dialog;
    this.sidebarEl = document.getElementById("sidebar-right")!;
    this.treeContainerEl = document.getElementById("tree-container")!;
    this.workspaceLabelEl = document.getElementById("workspace-path-label")!;

    this.bindEvents();
  }

  private bindEvents(): void {
    document.getElementById("btn-toggle-sidebar")!.addEventListener("click", () => {
      this.toggleSidebar();
    });

    document.getElementById("btn-new-note")!.addEventListener("click", () => {
      void this.promptCreateNote(state.selectedFolderRelPath);
    });

    document.getElementById("btn-new-folder")!.addEventListener("click", () => {
      void this.promptCreateFolder(state.selectedFolderRelPath);
    });

    document.getElementById("btn-empty-new-note")!.addEventListener("click", () => {
      void this.promptCreateNote("");
    });

    document.getElementById("btn-empty-new-folder")!.addEventListener("click", () => {
      void this.promptCreateFolder("");
    });

    document.getElementById("btn-change-workspace")!.addEventListener("click", () => {
      void this.chooseWorkspaceDirectory();
    });

    document.getElementById("btn-empty-choose-workspace")!.addEventListener("click", () => {
      void this.chooseWorkspaceDirectory();
    });

    // Click on blank area of tree resets selected folder to root
    this.treeContainerEl.addEventListener("click", (e) => {
      if (e.target === this.treeContainerEl) {
        state.selectedFolderRelPath = "";
        this.renderTree();
      }
    });
  }

  public setSidebarCollapsed(collapsed: boolean, persist = true): void {
    state.sidebarCollapsed = collapsed;
    if (collapsed) {
      this.sidebarEl.classList.add("collapsed");
    } else {
      this.sidebarEl.classList.remove("collapsed");
    }
    if (persist) {
      void Backend.setSidebarCollapsed(collapsed);
    }
  }

  public toggleSidebar(): void {
    this.setSidebarCollapsed(!state.sidebarCollapsed, true);
  }

  public updateWorkspaceLabel(): void {
    const full = state.workspacePath || "Espaço de trabalho";
    const parts = full.replace(/\\/g, "/").split("/").filter(Boolean);
    const shortName = parts.length >= 2 ? parts.slice(-2).join("/") : full;
    this.workspaceLabelEl.textContent = shortName;
    this.workspaceLabelEl.title = `Diretório local: ${full}\nClique para alterar o diretório de trabalho`;
  }

  public async refreshTree(): Promise<void> {
    state.tree = await Backend.getWorkspaceTree();
    this.renderTree();
  }

  public renderTree(): void {
    if (state.tree.length === 0) {
      this.treeContainerEl.innerHTML = `<div class="tree-empty">Nenhuma pasta ou anotação.<br/>Crie sua primeira nota ou pasta acima.</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    this.buildTreeDom(state.tree, 0, fragment);
    this.treeContainerEl.innerHTML = "";
    this.treeContainerEl.appendChild(fragment);
  }

  private buildTreeDom(nodes: TreeNode[], depth: number, container: DocumentFragment | HTMLElement): void {
    for (const node of nodes) {
      const row = document.createElement("div");
      const isExpanded = state.expandedFolders.has(node.relPath);
      const isActiveDoc = !node.isDir && state.activeDoc?.relPath === node.relPath;
      const isSelectedFolder = node.isDir && state.selectedFolderRelPath === node.relPath;

      row.className = `tree-item-row ${node.isDir ? "folder" : "file"} ${
        isActiveDoc ? "active" : ""
      } ${isSelectedFolder ? "selected-folder" : ""}`;
      row.style.paddingLeft = `${8 + depth * 14}px`;
      row.title = node.relPath;

      if (node.isDir) {
        row.innerHTML = `
          <span class="tree-chevron ${isExpanded ? "open" : ""}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
          <span class="tree-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </span>
          <span class="tree-label">${escapeHtml(node.name)}</span>
          <span class="tree-row-actions">
            <button type="button" class="tree-mini-btn" data-action="new-note" title="Nova nota nesta pasta">+</button>
            <button type="button" class="tree-mini-btn" data-action="new-subfolder" title="Nova subpasta">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            <button type="button" class="tree-mini-btn" data-action="rename" title="Renomear pasta">✎</button>
            <button type="button" class="tree-mini-btn danger" data-action="delete" title="Excluir pasta">✕</button>
          </span>
        `;
      } else {
        const displayName = node.name.replace(/\.(txt|md)$/i, "");
        row.innerHTML = `
          <span class="tree-chevron"></span>
          <span class="tree-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </span>
          <span class="tree-label">${escapeHtml(displayName)}</span>
          <span class="tree-row-actions">
            <button type="button" class="tree-mini-btn" data-action="rename" title="Renomear arquivo">✎</button>
            <button type="button" class="tree-mini-btn danger" data-action="delete" title="Excluir arquivo">✕</button>
          </span>
        `;
      }

      row.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
        if (btn) {
          e.stopPropagation();
          const action = btn.dataset.action;
          if (action === "new-note") {
            void this.promptCreateNote(node.relPath);
          } else if (action === "new-subfolder") {
            void this.promptCreateFolder(node.relPath);
          } else if (action === "rename") {
            void this.promptRenameEntry(node);
          } else if (action === "delete") {
            void this.promptDeleteEntry(node);
          }
          return;
        }

        if (node.isDir) {
          state.selectedFolderRelPath = node.relPath;
          if (state.expandedFolders.has(node.relPath)) {
            state.expandedFolders.delete(node.relPath);
          } else {
            state.expandedFolders.add(node.relPath);
          }
          this.renderTree();
        } else {
          state.selectedFolderRelPath = getParentFolder(node.relPath);
          void this.openDocumentByRelPath(node.relPath);
        }
      });

      container.appendChild(row);

      if (node.isDir && isExpanded && node.children && node.children.length > 0) {
        this.buildTreeDom(node.children, depth + 1, container);
      }
    }
  }

  public async openDocumentByRelPath(relPath: string): Promise<void> {
    try {
      await this.editor.flushSave();
      const doc = await Backend.readDocument(relPath);
      expandParentChain(doc.relPath);
      await this.editor.loadDocument(doc);
      this.renderTree();
    } catch (err) {
      console.error("Erro ao abrir documento:", err);
    }
  }

  public async promptCreateNote(parentFolderRel: string): Promise<void> {
    const locationHint = parentFolderRel ? `na pasta "${parentFolderRel}"` : "na raiz do espaço de trabalho";
    const name = await this.dialog.prompt({
      title: "Nova anotação Markdown (.md)",
      message: `Criar arquivo .md ${locationHint}:`,
      placeholder: "ex: ideias.md",
      confirmLabel: "Criar nota",
      validate: (val) => {
        if (/[<>:"/\\|?*]/.test(val)) {
          return "O nome não pode conter caracteres especiais de caminho.";
        }
        return null;
      },
    });

    if (!name) return;

    try {
      await this.editor.flushSave();
      const doc = await Backend.createDocument(parentFolderRel, name);
      if (parentFolderRel) {
        state.expandedFolders.add(parentFolderRel);
      }
      expandParentChain(doc.relPath);
      await this.refreshTree();
      await this.editor.loadDocument(doc);
      this.renderTree();
    } catch (err) {
      await this.dialog.confirm({
        title: "Não foi possível criar a anotação",
        message: String(err),
        confirmLabel: "Entendi",
      });
    }
  }

  public async promptCreateFolder(parentFolderRel: string): Promise<void> {
    const locationHint = parentFolderRel ? `dentro de "${parentFolderRel}"` : "na raiz do espaço de trabalho";
    const name = await this.dialog.prompt({
      title: "Nova pasta",
      message: `Criar pasta ${locationHint}:`,
      placeholder: "ex: Estudos",
      confirmLabel: "Criar pasta",
      validate: (val) => {
        if (/[<>:"/\\|?*]/.test(val) || val === "." || val === "..") {
          return "Informe um nome de pasta simples e válido.";
        }
        return null;
      },
    });

    if (!name) return;

    try {
      const createdRel = await Backend.createFolder(parentFolderRel, name);
      if (parentFolderRel) {
        state.expandedFolders.add(parentFolderRel);
      }
      state.expandedFolders.add(createdRel);
      state.selectedFolderRelPath = createdRel;
      await this.refreshTree();
    } catch (err) {
      await this.dialog.confirm({
        title: "Não foi possível criar a pasta",
        message: String(err),
        confirmLabel: "Entendi",
      });
    }
  }

  private async promptRenameEntry(node: TreeNode): Promise<void> {
    const label = node.isDir ? "pasta" : "anotação";
    const newName = await this.dialog.prompt({
      title: `Renomear ${label}`,
      initialValue: node.name,
      confirmLabel: "Renomear",
      validate: (val) => {
        if (/[<>:"/\\|?*]/.test(val) || val === "." || val === "..") {
          return "O novo nome não pode conter caracteres inválidos.";
        }
        return null;
      },
    });

    if (!newName || newName === node.name) return;

    try {
      await this.editor.flushSave();
      const res = await Backend.renameEntry(node.relPath, newName);

      // Update expanded folders & active doc if affected
      if (res.isDir) {
        if (state.expandedFolders.has(res.oldRelPath)) {
          state.expandedFolders.delete(res.oldRelPath);
          state.expandedFolders.add(res.newRelPath);
        }
        if (state.selectedFolderRelPath === res.oldRelPath) {
          state.selectedFolderRelPath = res.newRelPath;
        }
      }

      if (state.activeDoc) {
        if (state.activeDoc.relPath === res.oldRelPath) {
          const updatedDoc = await Backend.readDocument(res.newRelPath);
          await this.editor.loadDocument(updatedDoc);
        } else if (state.activeDoc.relPath.startsWith(`${res.oldRelPath}/`)) {
          const suffix = state.activeDoc.relPath.slice(res.oldRelPath.length);
          const updatedDoc = await Backend.readDocument(`${res.newRelPath}${suffix}`);
          await this.editor.loadDocument(updatedDoc);
        }
      }

      await this.refreshTree();
    } catch (err) {
      await this.dialog.confirm({
        title: "Erro ao renomear",
        message: String(err),
        confirmLabel: "Entendi",
      });
    }
  }

  private async promptDeleteEntry(node: TreeNode): Promise<void> {
    const label = node.isDir ? `a pasta "${node.name}" e todo o seu conteúdo` : `a anotação "${node.name}"`;
    const confirmed = await this.dialog.confirm({
      title: node.isDir ? "Excluir pasta" : "Excluir anotação",
      message: `Tem certeza de que deseja excluir permanentemente ${label} do disco?`,
      confirmLabel: "Excluir",
      danger: true,
    });

    if (!confirmed) return;

    try {
      const wasActive =
        state.activeDoc &&
        (state.activeDoc.relPath === node.relPath ||
          state.activeDoc.relPath.startsWith(`${node.relPath}/`));

      if (wasActive) {
        state.saveStatus = "saved";
        await this.editor.loadDocument(null);
      }

      await Backend.deleteEntry(node.relPath);
      state.expandedFolders.delete(node.relPath);
      if (state.selectedFolderRelPath === node.relPath) {
        state.selectedFolderRelPath = "";
      }
      await this.refreshTree();
    } catch (err) {
      await this.dialog.confirm({
        title: "Erro ao excluir",
        message: String(err),
        confirmLabel: "Entendi",
      });
    }
  }

  public async chooseWorkspaceDirectory(): Promise<void> {
    try {
      await this.editor.flushSave();
      const payload = await Backend.selectWorkspaceDirectory();
      if (!payload) return;

      state.workspacePath = payload.workspacePath;
      state.tree = payload.tree;
      state.expandedFolders.clear();
      state.selectedFolderRelPath = "";
      if (payload.activeDocument) {
        expandParentChain(payload.activeDocument.relPath);
      }
      this.updateWorkspaceLabel();
      this.renderTree();
      await this.editor.loadDocument(payload.activeDocument);
    } catch (err) {
      console.error("Erro ao selecionar diretório de trabalho:", err);
    }
  }
}
