export class FilterDropdown {
  readonly el: HTMLElement;
  private ci = 0;
  private sort: "asc" | "desc" | undefined;
  private values: string[] = [];
  private selected = new Set<string>();
  private ignoreOutside = false;
  onOk?: (ci: number, order: "asc" | "desc" | undefined, values: string[]) => void;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ho-sheet-sort-filter";
    this.el.hidden = true;
    this.el.addEventListener("mousedown", (event) => event.stopPropagation());
    this.el.addEventListener("click", this.onClick);
    document.addEventListener("mousedown", this.onDocument);
  }

  set(
    ci: number,
    items: Record<string, number>,
    selected: string[] | undefined,
    sort: "asc" | "desc" | undefined,
  ): void {
    this.ci = ci;
    this.sort = sort;
    this.values = Object.keys(items);
    this.selected = new Set(selected ?? this.values);
    this.el.innerHTML = `
      <button type="button" class="ho-sheet-sort-item${sort === "asc" ? " is-on" : ""}" data-sort="asc">升序</button>
      <button type="button" class="ho-sheet-sort-item${sort === "desc" ? " is-on" : ""}" data-sort="desc">降序</button>
      <div class="ho-sheet-sort-split"></div>
      <div class="ho-sheet-filter">
        <button type="button" class="ho-sheet-filter-head" data-all>${this.selected.size} / ${this.values.length}</button>
        <div class="ho-sheet-filter-body">
          ${this.values.map((value) => {
            const on = this.selected.has(value) ? " is-on" : "";
            const label = value === "" ? "空白" : escapeHtml(value);
            return `<button type="button" class="ho-sheet-filter-item${on}" data-value="${escapeAttr(value)}">${label}<span>(${items[value]})</span></button>`;
          }).join("")}
        </div>
      </div>
      <div class="ho-sheet-filter-actions">
        <button type="button" data-act="cancel">取消</button>
        <button type="button" class="is-primary" data-act="ok">确定</button>
      </div>
    `;
  }

  show(left: number, top: number): void {
    this.el.hidden = false;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    document.body.append(this.el);
    this.ignoreOutside = true;
    window.setTimeout(() => {
      this.ignoreOutside = false;
    }, 0);
  }

  hide(): void {
    this.el.hidden = true;
    this.el.remove();
  }

  private onClick = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (!target) {
      return;
    }
    if (target.dataset.sort) {
      const next = target.dataset.sort as "asc" | "desc";
      this.sort = this.sort === next ? undefined : next;
      this.el.querySelectorAll("[data-sort]").forEach((item) => {
        item.classList.toggle("is-on", item.getAttribute("data-sort") === this.sort);
      });
      return;
    }
    if (target.dataset.all !== undefined) {
      if (this.selected.size === this.values.length) {
        this.selected.clear();
      } else {
        this.selected = new Set(this.values);
      }
      this.syncChecks();
      return;
    }
    if (target.dataset.value !== undefined) {
      const value = target.dataset.value;
      if (this.selected.has(value)) {
        this.selected.delete(value);
      } else {
        this.selected.add(value);
      }
      this.syncChecks();
      return;
    }
    if (target.dataset.act === "ok") {
      this.onOk?.(this.ci, this.sort, [...this.selected]);
      this.hide();
      return;
    }
    if (target.dataset.act === "cancel") {
      this.hide();
    }
  };

  private onDocument = (event: MouseEvent): void => {
    if (this.el.hidden || this.ignoreOutside || this.el.contains(event.target as Node)) {
      return;
    }
    this.hide();
  };

  private syncChecks(): void {
    const head = this.el.querySelector(".ho-sheet-filter-head");
    if (head) {
      head.textContent = `${this.selected.size} / ${this.values.length}`;
    }
    this.el.querySelectorAll<HTMLElement>("[data-value]").forEach((item) => {
      item.classList.toggle("is-on", this.selected.has(item.dataset.value ?? ""));
    });
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}
