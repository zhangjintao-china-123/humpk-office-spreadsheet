export class CellSelectDropdown {
  readonly el: HTMLElement;
  private ignoreOutside = false;
  onPick?: (value: string) => void;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ho-sheet-cell-select";
    this.el.hidden = true;
    this.el.addEventListener("mousedown", (event) => event.stopPropagation());
    this.el.addEventListener("click", this.onClick);
    document.addEventListener("mousedown", this.onDocument);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  set(options: string[], current: string): void {
    if (!options.length) {
      this.el.innerHTML = `<div class="ho-sheet-cell-select-empty">未定义选项</div>`;
      return;
    }
    this.el.innerHTML = options
      .map((option) => {
        const selected = option === current ? " is-on" : "";
        return `<button type="button" class="ho-sheet-cell-select-item${selected}" data-value="${escapeAttr(option)}">${escapeHtml(option)}</button>`;
      })
      .join("");
  }

  show(left: number, top: number, width: number): void {
    this.el.hidden = false;
    this.el.style.minWidth = `${Math.max(80, width)}px`;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    document.body.append(this.el);
    const rect = this.el.getBoundingClientRect();
    let nextLeft = left;
    let nextTop = top;
    if (rect.right > window.innerWidth - 8) {
      nextLeft = Math.max(8, window.innerWidth - rect.width - 8);
    }
    if (rect.bottom > window.innerHeight - 8) {
      nextTop = Math.max(8, top - rect.height - 4);
    }
    this.el.style.left = `${nextLeft}px`;
    this.el.style.top = `${nextTop}px`;
    this.ignoreOutside = true;
    window.setTimeout(() => {
      this.ignoreOutside = false;
    }, 0);
  }

  hide(): void {
    this.el.hidden = true;
    this.el.remove();
  }

  destroy(): void {
    document.removeEventListener("mousedown", this.onDocument);
    this.hide();
  }

  private onClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-value]");
    if (!button || button.dataset.value === undefined) {
      return;
    }
    this.hide();
    this.onPick?.(button.dataset.value);
  };

  private onDocument = (event: MouseEvent): void => {
    if (this.ignoreOutside || this.el.hidden || this.el.contains(event.target as Node)) {
      return;
    }
    this.hide();
  };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replaceAll("'", "&#39;");
}
