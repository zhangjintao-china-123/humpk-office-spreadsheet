import { placeContextMenu } from "../contextmenu/placeMenu";
import type { Workspace } from "../workspace/Workspace";

export function dropSheetIndex(from: number, over: number, after: boolean): number {
  let to = after ? over + 1 : over;
  if (from < to) {
    to -= 1;
  }
  return to;
}

export class SheetTabs {
  readonly el: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly list: HTMLElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private readonly addBtn: HTMLButtonElement;
  private menuIndex = -1;
  private dragFrom = -1;

  constructor(host: HTMLElement, private readonly workspace: Workspace) {
    this.el = host;
    host.classList.add("ho-sheet-tabs");
    const nav = document.createElement("div");
    nav.className = "ho-sheet-tab-nav";
    this.prevBtn = createTabArrow("scroll-left", "向左滚动页签", true);
    this.nextBtn = createTabArrow("scroll-right", "向右滚动页签", false);
    nav.append(this.prevBtn, this.nextBtn);
    this.list = document.createElement("div");
    this.list.className = "ho-sheet-tab-list";
    this.addBtn = document.createElement("button");
    this.addBtn.type = "button";
    this.addBtn.className = "ho-sheet-tab-add";
    this.addBtn.dataset.act = "add";
    this.addBtn.title = "新增工作表";
    this.addBtn.textContent = "+";
    host.replaceChildren(nav, this.list, this.addBtn);

    this.menu = document.createElement("div");
    this.menu.className = "ho-sheet-contextmenu";
    this.menu.hidden = true;
    this.menu.innerHTML = `
      <button type="button" data-act="rename">重命名</button>
      <button type="button" data-act="move-left">左移</button>
      <button type="button" data-act="move-right">右移</button>
      <div class="ho-sheet-contextmenu-split"></div>
      <button type="button" data-act="delete">删除</button>
    `;
    this.menu.addEventListener("mousedown", (event) => event.preventDefault());
    this.menu.addEventListener("click", this.onMenuClick);
    host.addEventListener("click", this.onClick);
    host.addEventListener("dblclick", this.onDbl);
    host.addEventListener("contextmenu", this.onContextMenu);
    this.list.addEventListener("dragstart", this.onDragStart);
    this.list.addEventListener("dragover", this.onDragOver);
    this.list.addEventListener("dragleave", this.onDragLeave);
    this.list.addEventListener("drop", this.onDrop);
    this.list.addEventListener("dragend", this.onDragEnd);
    this.list.addEventListener("scroll", this.syncScrollButtons);
    this.list.addEventListener("wheel", this.onWheel, { passive: false });
    document.addEventListener("mousedown", this.onDocDown);
    new ResizeObserver(this.syncScrollButtons).observe(this.list);
    this.sync();
  }

  sync(): void {
    this.hideMenu();
    const state = this.workspace.formatState();
    this.renderTabs(state.sheetNames, state.activeSheet);
  }

  private renderTabs(names: string[], activeSheet: number): void {
    const buttons = Array.from(this.list.querySelectorAll<HTMLButtonElement>(":scope > .ho-sheet-tab"));
    const canDrag = names.length > 1;
    names.forEach((name, i) => {
      const btn = buttons[i] ?? this.createTabButton();
      if (!buttons[i]) {
        this.list.append(btn);
      }
      btn.dataset.sheet = String(i);
      btn.draggable = canDrag;
      btn.title = name;
      btn.classList.toggle("is-on", i === activeSheet);
      if (btn.textContent !== name) {
        btn.textContent = name;
      }
    });
    for (let i = names.length; i < buttons.length; i += 1) {
      buttons[i].remove();
    }
    requestAnimationFrame(() => {
      this.scrollActiveIntoView();
      this.syncScrollButtons();
    });
  }

  private createTabButton(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ho-sheet-tab";
    return btn;
  }

  private onClick = (event: MouseEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-sheet], [data-act]");
    if (!target) {
      return;
    }
    if (target.dataset.act === "add") {
      this.workspace.addSheet();
      return;
    }
    if (target.dataset.act === "scroll-left") {
      this.scrollTabs(-1);
      return;
    }
    if (target.dataset.act === "scroll-right") {
      this.scrollTabs(1);
      return;
    }
    if (target.dataset.sheet) {
      this.workspace.switchSheet(Number(target.dataset.sheet));
    }
  };

  private onDbl = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-sheet]");
    if (!button) {
      return;
    }
    event.preventDefault();
    this.requestRename(Number(button.dataset.sheet));
  };

  private onContextMenu = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-sheet]");
    if (!button) {
      return;
    }
    event.preventDefault();
    const index = Number(button.dataset.sheet);
    this.workspace.switchSheet(index);
    this.showMenu(index, event.clientX, event.clientY);
  };

  private onMenuClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-act]");
    if (!button || button.disabled) {
      return;
    }
    const index = this.menuIndex;
    this.hideMenu();
    if (index < 0) {
      return;
    }
    if (button.dataset.act === "rename") {
      this.requestRename(index);
      return;
    }
    if (button.dataset.act === "move-left") {
      this.workspace.moveSheet(index, index - 1);
      return;
    }
    if (button.dataset.act === "move-right") {
      this.workspace.moveSheet(index, index + 1);
      return;
    }
    if (button.dataset.act === "delete") {
      this.deleteSheet(index);
    }
  };

  private onDocDown = (event: MouseEvent): void => {
    if (!this.menu.contains(event.target as Node)) {
      this.hideMenu();
    }
  };

  private onDragStart = (event: DragEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-sheet]");
    if (!button || this.workspace.workbook.sheets.length <= 1) {
      event.preventDefault();
      return;
    }
    const index = Number(button.dataset.sheet);
    this.dragFrom = index;
    button.classList.add("is-dragging");
    event.dataTransfer?.setData("text/plain", String(index));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
    this.workspace.switchSheet(index);
  };

  private onDragOver = (event: DragEvent): void => {
    if (this.dragFrom < 0) {
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-sheet]");
    if (!button) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    const after = this.isAfter(button, event.clientX);
    this.clearDropHint();
    button.classList.add(after ? "drop-after" : "drop-before");
  };

  private onDragLeave = (event: DragEvent): void => {
    const related = event.relatedTarget as Node | null;
    if (related && this.list.contains(related)) {
      return;
    }
    this.clearDropHint();
  };

  private onDrop = (event: DragEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-sheet]");
    if (!button || this.dragFrom < 0) {
      return;
    }
    event.preventDefault();
    const over = Number(button.dataset.sheet);
    const to = dropSheetIndex(this.dragFrom, over, this.isAfter(button, event.clientX));
    this.workspace.moveSheet(this.dragFrom, to);
    this.finishDrag();
  };

  private onDragEnd = (): void => {
    this.finishDrag();
  };

  private finishDrag(): void {
    this.dragFrom = -1;
    this.clearDropHint();
    for (const btn of Array.from(this.list.querySelectorAll(".is-dragging"))) {
      btn.classList.remove("is-dragging");
    }
  }

  private clearDropHint(): void {
    for (const btn of Array.from(this.list.querySelectorAll(".drop-before, .drop-after"))) {
      btn.classList.remove("drop-before", "drop-after");
    }
  }

  private onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey) {
      return;
    }
    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!delta) {
      return;
    }
    event.preventDefault();
    this.list.scrollLeft += delta;
  };

  private scrollTabs(dir: -1 | 1): void {
    const step = Math.max(120, Math.round(this.list.clientWidth * 0.7));
    this.list.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  private scrollActiveIntoView(): void {
    const active = this.list.querySelector<HTMLElement>(".ho-sheet-tab.is-on");
    if (!active) {
      return;
    }
    const parent = this.list.getBoundingClientRect();
    const child = active.getBoundingClientRect();
    if (child.left < parent.left) {
      this.list.scrollLeft += child.left - parent.left - 8;
    } else if (child.right > parent.right) {
      this.list.scrollLeft += child.right - parent.right + 8;
    }
  }

  private syncScrollButtons = (): void => {
    const max = this.list.scrollWidth - this.list.clientWidth;
    const overflow = max > 1;
    this.prevBtn.disabled = !overflow || this.list.scrollLeft <= 1;
    this.nextBtn.disabled = !overflow || this.list.scrollLeft >= max - 1;
  };

  private isAfter(button: HTMLElement, clientX: number): boolean {
    const rect = button.getBoundingClientRect();
    return clientX > rect.left + rect.width / 2;
  }

  private showMenu(index: number, x: number, y: number): void {
    this.menuIndex = index;
    const count = this.workspace.workbook.sheets.length;
    const deleteBtn = this.menu.querySelector<HTMLButtonElement>('[data-act="delete"]');
    const leftBtn = this.menu.querySelector<HTMLButtonElement>('[data-act="move-left"]');
    const rightBtn = this.menu.querySelector<HTMLButtonElement>('[data-act="move-right"]');
    if (deleteBtn) {
      deleteBtn.disabled = count <= 1;
    }
    if (leftBtn) {
      leftBtn.disabled = index <= 0;
    }
    if (rightBtn) {
      rightBtn.disabled = index < 0 || index >= count - 1;
    }
    placeContextMenu(this.menu, x, y);
  }

  private hideMenu(): void {
    this.menuIndex = -1;
    this.menu.hidden = true;
    this.menu.remove();
  }

  private requestRename(index: number): void {
    const current = this.workspace.workbook.sheets[index]?.name ?? "";
    this.workspace.cancelCaptureFocus();
    this.workspace.onRequestRenameSheet?.(index, current);
  }

  private deleteSheet(index: number): void {
    if (this.workspace.workbook.sheets.length <= 1) {
      window.alert("至少保留一张工作表");
      return;
    }
    const name = this.workspace.workbook.sheets[index]?.name ?? "工作表";
    if (!window.confirm(`确定删除工作表「${name}」？`)) {
      return;
    }
    this.workspace.deleteSheet(index);
  }
}

function createTabArrow(act: "scroll-left" | "scroll-right", title: string, left: boolean): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ho-sheet-tab-arrow";
  btn.dataset.act = act;
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.innerHTML = left
    ? `<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M7.6 2.2 3.8 6l3.8 3.8-.8.8L2.2 6 6.8 1.4z"/></svg>`
    : `<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M4.4 2.2 8.2 6l-3.8 3.8.8.8L9.8 6 5.2 1.4z"/></svg>`;
  return btn;
}
