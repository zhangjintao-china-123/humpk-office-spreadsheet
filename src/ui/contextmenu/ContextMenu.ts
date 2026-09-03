export type MenuAction =
  | "cut"
  | "copy"
  | "paste"
  | "clear"
  | "insert-row"
  | "insert-col"
  | "delete-row"
  | "delete-col"
  | "merge"
  | "unmerge"
  | "insert-image"
  | "delete-image"
  | "autofilter"
  | "freeze";

export class ContextMenu {
  readonly el: HTMLElement;

  constructor(private readonly onAction: (action: MenuAction) => void) {
    this.el = document.createElement("div");
    this.el.className = "ho-sheet-contextmenu";
    this.el.hidden = true;
    this.el.innerHTML = `
      <button type="button" data-act="cut">剪切</button>
      <button type="button" data-act="copy">复制</button>
      <button type="button" data-act="paste">粘贴</button>
      <button type="button" data-act="clear">清除</button>
      <div class="ho-sheet-contextmenu-split"></div>
      <button type="button" data-act="insert-row">插入行</button>
      <button type="button" data-act="insert-col">插入列</button>
      <button type="button" data-act="delete-row">删除行</button>
      <button type="button" data-act="delete-col">删除列</button>
      <div class="ho-sheet-contextmenu-split"></div>
      <button type="button" data-act="merge">合并单元格</button>
      <button type="button" data-act="unmerge">取消合并</button>
      <div class="ho-sheet-contextmenu-split"></div>
      <button type="button" data-act="insert-image">插入图片</button>
      <button type="button" data-act="delete-image">删除图片</button>
      <div class="ho-sheet-contextmenu-split"></div>
      <button type="button" data-act="autofilter">自动筛选</button>
      <button type="button" data-act="freeze">冻结窗格</button>
    `;
    this.el.addEventListener("mousedown", (event) => event.preventDefault());
    this.el.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
      if (button?.dataset.act) {
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
    this.el.hidden = false;
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    document.body.append(this.el);
  }

  hide(): void {
    this.el.hidden = true;
    this.el.remove();
  }
}
