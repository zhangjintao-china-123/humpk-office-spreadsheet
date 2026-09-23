import { placeContextMenu, placeSubmenu } from "./placeMenu";
import { noteMarkMenuMarkup } from "../ribbon/MarkPalette";

export type MenuAction =
  | "cut"
  | "copy"
  | "paste"
  | "clear"
  | "find"
  | "insert-row"
  | "append-row"
  | "insert-col"
  | "delete-row"
  | "delete-col"
  | "merge"
  | "unmerge"
  | "insert-image"
  | "delete-image"
  | "autofilter"
  | "freeze"
  | "set-priority"
  | "set-shape"
  | "set-verdict"
  | "unmark"
  | "unmark-sheet"
  | "edit-note"
  | "delete-note"
  | "allow-edit"
  | "deny-edit"
  | "control-text"
  | "control-dropdown"
  | "control-switch";

function submenu(label: string, items: string, attrs = ""): string {
  return `
    <div class="ho-sheet-submenu"${attrs ? ` ${attrs}` : ""}>
      <button type="button" class="ho-sheet-submenu-trigger">
        ${label}<span class="ho-sheet-submenu-arrow">›</span>
      </button>
      <div class="ho-sheet-contextmenu ho-sheet-submenu-panel">
        ${items}
      </div>
    </div>
  `;
}

export class ContextMenu {
  readonly el: HTMLElement;

  constructor(
    private readonly onAction: (action: MenuAction, value?: string) => void,
    options?: { templateMode?: boolean },
  ) {
    this.el = document.createElement("div");
    this.el.className = "ho-sheet-contextmenu";
    this.el.hidden = true;
    const templateItems = options?.templateMode
      ? `
      <div class="ho-sheet-contextmenu-split" data-edit-control-menu hidden></div>
      ${submenu("可编辑", `
        <button type="button" data-act="control-text">文本输入</button>
        <button type="button" data-act="control-dropdown">下拉列表…</button>
        <button type="button" data-act="control-switch">开关</button>
        <button type="button" data-act="deny-edit">取消可编辑</button>
      `, `data-edit-control-menu hidden`)}
    `
      : "";
    this.el.innerHTML = `
      <button type="button" data-act="cut">剪切</button>
      <button type="button" data-act="copy">复制</button>
      <button type="button" data-act="paste">粘贴</button>
      <button type="button" data-act="clear">清除</button>
      <button type="button" data-act="find">查找...</button>
      <div class="ho-sheet-contextmenu-split"></div>
      ${submenu("插入", `
        <button type="button" data-act="insert-row">插入行</button>
        <button type="button" data-act="append-row">在下方追加行</button>
        <button type="button" data-act="insert-col">插入列</button>
      `)}
      ${submenu("删除", `
        <button type="button" data-act="delete-row">删除行</button>
        <button type="button" data-act="delete-col">删除列</button>
      `)}
      <div class="ho-sheet-contextmenu-split"></div>
      ${submenu("单元格", `
        <button type="button" data-act="merge">合并单元格</button>
        <button type="button" data-act="unmerge">取消合并</button>
      `)}
      ${submenu("备注和标记", noteMarkMenuMarkup())}
      ${submenu("图片", `
        <button type="button" data-act="insert-image">插入图片</button>
        <button type="button" data-act="delete-image">删除图片</button>
      `)}
      ${submenu("视图", `
        <button type="button" data-act="autofilter">自动筛选</button>
        <button type="button" data-act="freeze">冻结窗格</button>
      `)}
      ${templateItems}
    `;
    this.el.addEventListener("mousedown", (event) => event.preventDefault());
    this.el.addEventListener("mouseover", (event) => this.onHover(event.target as HTMLElement));
    this.el.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>("[data-act], [data-priority], [data-shape], [data-verdict]");
      if (!button || !this.el.contains(button)) {
        return;
      }
      if (button.dataset.priority) {
        this.hide();
        this.onAction("set-priority", button.dataset.priority);
        return;
      }
      if (button.dataset.shape) {
        this.hide();
        this.onAction("set-shape", button.dataset.shape);
        return;
      }
      if (button.dataset.verdict) {
        this.hide();
        this.onAction("set-verdict", button.dataset.verdict);
        return;
      }
      if (button.dataset.act) {
        this.hide();
        this.onAction(button.dataset.act as MenuAction);
      }
    });
    document.addEventListener("mousedown", (event) => {
      if (!this.el.contains(event.target as Node)) {
        this.hide();
      }
    });
  }

  show(x: number, y: number): void {
    this.closeSubmenus();
    placeContextMenu(this.el, x, y);
  }

  hide(): void {
    this.closeSubmenus();
    this.el.hidden = true;
    this.el.remove();
  }

  setEditControl(on: boolean): void {
    this.el.querySelectorAll<HTMLElement>("[data-edit-control-menu]").forEach((item) => {
      item.hidden = !on;
    });
  }

  private onHover(target: HTMLElement): void {
    const submenu = target.closest<HTMLElement>(".ho-sheet-submenu");
    for (const open of Array.from(this.el.querySelectorAll(".ho-sheet-submenu.is-open"))) {
      if (open !== submenu) {
        open.classList.remove("is-open");
      }
    }
    if (!submenu || !this.el.contains(submenu)) {
      return;
    }
    submenu.classList.add("is-open");
    const panel = submenu.querySelector<HTMLElement>(":scope > .ho-sheet-submenu-panel");
    if (panel) {
      placeSubmenu(panel);
    }
  }

  private closeSubmenus(): void {
    for (const open of Array.from(this.el.querySelectorAll(".ho-sheet-submenu.is-open"))) {
      open.classList.remove("is-open");
    }
  }
}
