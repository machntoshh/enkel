export interface PromptDialogOptions {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  validate?: (val: string) => string | null;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export class DialogController {
  private modalEl: HTMLElement;
  private titleEl: HTMLElement;
  private messageEl: HTMLElement;
  private inputWrapEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private errorEl: HTMLElement;
  private cancelBtn: HTMLButtonElement;
  private confirmBtn: HTMLButtonElement;

  private activeCleanup: (() => void) | null = null;

  constructor() {
    this.modalEl = document.getElementById("dialog-modal")!;
    this.titleEl = document.getElementById("dialog-title")!;
    this.messageEl = document.getElementById("dialog-message")!;
    this.inputWrapEl = document.getElementById("dialog-input-wrap")!;
    this.inputEl = document.getElementById("dialog-input") as HTMLInputElement;
    this.errorEl = document.getElementById("dialog-error")!;
    this.cancelBtn = document.getElementById("dialog-btn-cancel") as HTMLButtonElement;
    this.confirmBtn = document.getElementById("dialog-btn-confirm") as HTMLButtonElement;
  }

  public prompt(opts: PromptDialogOptions): Promise<string | null> {
    this.closeActive();

    return new Promise((resolve) => {
      this.titleEl.textContent = opts.title;
      if (opts.message) {
        this.messageEl.textContent = opts.message;
        this.messageEl.classList.remove("hidden");
      } else {
        this.messageEl.classList.add("hidden");
      }

      this.inputWrapEl.classList.remove("hidden");
      this.inputEl.value = opts.initialValue ?? "";
      this.inputEl.placeholder = opts.placeholder ?? "";
      this.errorEl.classList.add("hidden");
      this.errorEl.textContent = "";

      this.confirmBtn.textContent = opts.confirmLabel ?? "Confirmar";
      this.confirmBtn.classList.remove("danger");
      this.modalEl.classList.remove("hidden");

      const finish = (result: string | null) => {
        this.closeActive();
        resolve(result);
      };

      const submit = () => {
        const val = this.inputEl.value.trim();
        if (!val) {
          this.showError("Informe um nome válido.");
          return;
        }
        if (opts.validate) {
          const err = opts.validate(val);
          if (err) {
            this.showError(err);
            return;
          }
        }
        finish(val);
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      };

      const onBackdrop = (e: MouseEvent) => {
        if (e.target === this.modalEl) finish(null);
      };

      const onCancel = () => finish(null);

      this.confirmBtn.addEventListener("click", submit);
      this.cancelBtn.addEventListener("click", onCancel);
      this.inputEl.addEventListener("keydown", onKeyDown);
      this.modalEl.addEventListener("mousedown", onBackdrop);

      this.activeCleanup = () => {
        this.confirmBtn.removeEventListener("click", submit);
        this.cancelBtn.removeEventListener("click", onCancel);
        this.inputEl.removeEventListener("keydown", onKeyDown);
        this.modalEl.removeEventListener("mousedown", onBackdrop);
        this.modalEl.classList.add("hidden");
      };

      requestAnimationFrame(() => {
        this.inputEl.focus();
        const lowerVal = this.inputEl.value.toLowerCase();
        const extIdx = lowerVal.endsWith(".txt")
          ? this.inputEl.value.length - 4
          : lowerVal.endsWith(".md")
          ? this.inputEl.value.length - 3
          : -1;
        if (extIdx > 0) {
          this.inputEl.setSelectionRange(0, extIdx);
        } else {
          this.inputEl.select();
        }
      });
    });
  }

  public confirm(opts: ConfirmDialogOptions): Promise<boolean> {
    this.closeActive();

    return new Promise((resolve) => {
      this.titleEl.textContent = opts.title;
      this.messageEl.textContent = opts.message;
      this.messageEl.classList.remove("hidden");
      this.inputWrapEl.classList.add("hidden");
      this.errorEl.classList.add("hidden");

      this.confirmBtn.textContent = opts.confirmLabel ?? "Confirmar";
      if (opts.danger) {
        this.confirmBtn.classList.add("danger");
      } else {
        this.confirmBtn.classList.remove("danger");
      }

      this.modalEl.classList.remove("hidden");

      const finish = (result: boolean) => {
        this.closeActive();
        resolve(result);
      };

      const onConfirm = () => finish(true);
      const onCancel = () => finish(false);
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        } else if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        }
      };
      const onBackdrop = (e: MouseEvent) => {
        if (e.target === this.modalEl) finish(false);
      };

      this.confirmBtn.addEventListener("click", onConfirm);
      this.cancelBtn.addEventListener("click", onCancel);
      window.addEventListener("keydown", onKeyDown);
      this.modalEl.addEventListener("mousedown", onBackdrop);

      this.activeCleanup = () => {
        this.confirmBtn.removeEventListener("click", onConfirm);
        this.cancelBtn.removeEventListener("click", onCancel);
        window.removeEventListener("keydown", onKeyDown);
        this.modalEl.removeEventListener("mousedown", onBackdrop);
        this.modalEl.classList.add("hidden");
      };

      requestAnimationFrame(() => {
        this.confirmBtn.focus();
      });
    });
  }

  private showError(msg: string): void {
    this.errorEl.textContent = msg;
    this.errorEl.classList.remove("hidden");
  }

  private closeActive(): void {
    if (this.activeCleanup) {
      const fn = this.activeCleanup;
      this.activeCleanup = null;
      fn();
    }
  }
}
