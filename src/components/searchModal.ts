import { Backend, SearchResultItem } from "../core/ipc";
import { escapeHtml } from "../core/markdown";
import { SidebarController } from "./sidebar";

export class SearchModalController {
  private modalEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private listEl: HTMLElement;
  private sidebar: SidebarController;

  private results: SearchResultItem[] = [];
  private selectedIdx = 0;
  private searchTimer: number | null = null;

  constructor(sidebar: SidebarController) {
    this.sidebar = sidebar;
    this.modalEl = document.getElementById("search-modal")!;
    this.inputEl = document.getElementById("global-search-input") as HTMLInputElement;
    this.listEl = document.getElementById("search-results-list")!;

    this.bindEvents();
  }

  private bindEvents(): void {
    document.getElementById("btn-global-search")!.addEventListener("click", () => {
      void this.open();
    });

    this.modalEl.addEventListener("mousedown", (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    this.inputEl.addEventListener("input", () => {
      if (this.searchTimer !== null) {
        window.clearTimeout(this.searchTimer);
      }
      this.searchTimer = window.setTimeout(() => {
        void this.performSearch(this.inputEl.value.trim());
      }, 100);
    });

    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (this.results.length > 0) {
          this.selectedIdx = (this.selectedIdx + 1) % this.results.length;
          this.renderResults();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this.results.length > 0) {
          this.selectedIdx = (this.selectedIdx - 1 + this.results.length) % this.results.length;
          this.renderResults();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const chosen = this.results[this.selectedIdx];
        if (chosen) {
          this.close();
          void this.sidebar.openDocumentByRelPath(chosen.relPath);
        }
      }
    });
  }

  public async open(): Promise<void> {
    this.modalEl.classList.remove("hidden");
    this.inputEl.value = "";
    await this.performSearch("");
    requestAnimationFrame(() => {
      this.inputEl.focus();
    });
  }

  public close(): void {
    this.modalEl.classList.add("hidden");
  }

  private async performSearch(query: string): Promise<void> {
    try {
      this.results = await Backend.searchDocuments(query);
      this.selectedIdx = 0;
      this.renderResults();
    } catch (err) {
      console.error("Erro na pesquisa:", err);
    }
  }

  private renderResults(): void {
    if (this.results.length === 0) {
      this.listEl.innerHTML = `<div class="search-empty">Nenhum documento encontrado.</div>`;
      return;
    }

    this.listEl.innerHTML = "";
    this.results.forEach((item, idx) => {
      const el = document.createElement("div");
      el.className = `search-result-item ${idx === this.selectedIdx ? "selected" : ""}`;
      const lineBadge = item.lineNumber ? `:${item.lineNumber}` : "";
      el.innerHTML = `
        <div class="search-result-title">${escapeHtml(item.relPath)}${lineBadge}</div>
        <div class="search-result-snippet">${escapeHtml(item.snippet || "Documento Markdown")}</div>
      `;
      el.addEventListener("click", () => {
        this.close();
        void this.sidebar.openDocumentByRelPath(item.relPath);
      });
      this.listEl.appendChild(el);
    });
  }
}
