import "./styles/main.css";
import { DialogController } from "./components/dialog";
import { EditorController } from "./components/editor";
import { SearchModalController } from "./components/searchModal";
import { SidebarController } from "./components/sidebar";
import { Backend } from "./core/ipc";
import { expandParentChain, state } from "./core/state";

async function bootstrap(): Promise<void> {
  const dialog = new DialogController();
  const editor = new EditorController();
  const sidebar = new SidebarController(editor, dialog);
  const searchModal = new SearchModalController(sidebar);

  // Support / Thank You mini-page modal
  const supportModal = document.getElementById("support-modal");
  const openSupport = () => supportModal?.classList.remove("hidden");
  const closeSupport = () => supportModal?.classList.add("hidden");

  document.getElementById("btn-support")?.addEventListener("click", openSupport);
  document.getElementById("support-btn-close")?.addEventListener("click", closeSupport);
  document.getElementById("support-paypal-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    void Backend.openExternalUrl("https://livepix.gg/machntossh");
  });
  // Open any external HTTP/HTTPS anchor links in the OS default browser
  document.addEventListener("click", (e) => {
    const anchor = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href)) {
      e.preventDefault();
      void Backend.openExternalUrl(href);
    }
  });
  supportModal?.addEventListener("click", (e) => {
    if (e.target === supportModal) closeSupport();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && supportModal && !supportModal.classList.contains("hidden")) {
      closeSupport();
    }
  });

  // Global keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    const key = e.key.toLowerCase();

    // Ctrl+S: Manual / immediate save
    if (key === "s" && !e.shiftKey) {
      e.preventDefault();
      void editor.flushSave();
      return;
    }

    // Ctrl+N: New Markdown document
    if (key === "n" && !e.shiftKey) {
      e.preventDefault();
      void sidebar.promptCreateNote(state.selectedFolderRelPath);
      return;
    }

    // Ctrl+F: Search in current document
    if (key === "f" && !e.shiftKey) {
      e.preventDefault();
      editor.openFindBar();
      return;
    }

    // Ctrl+Shift+F or Ctrl+O: Search / Quick Open across documents
    if ((key === "f" && e.shiftKey) || (key === "o" && !e.shiftKey)) {
      e.preventDefault();
      void searchModal.open();
      return;
    }

    // Ctrl+E or Ctrl+P: Toggle Notion / Raw Markdown
    if ((key === "e" || key === "p") && !e.shiftKey) {
      e.preventDefault();
      editor.toggleRawMarkdownMode();
      return;
    }

    // Ctrl+\: Collapse or expand right sidebar
    if (e.key === "\\") {
      e.preventDefault();
      sidebar.toggleSidebar();
      return;
    }
  });

  // Ensure pending edits are saved before window closes
  window.addEventListener("beforeunload", () => {
    void editor.flushSave();
  });

  try {
    const initPayload = await Backend.initWorkspace();
    state.workspacePath = initPayload.workspacePath;
    state.tree = initPayload.tree;
    sidebar.setSidebarCollapsed(initPayload.sidebarCollapsed, false);

    if (initPayload.activeDocument) {
      expandParentChain(initPayload.activeDocument.relPath);
    }

    sidebar.updateWorkspaceLabel();
    sidebar.renderTree();
    await editor.loadDocument(initPayload.activeDocument);
  } catch (err) {
    console.error("Falha ao inicializar espaço de trabalho:", err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});
