import type { Workspace } from "../workspace/Workspace";

export class SheetTabs {
  readonly el: HTMLElement;

  constructor(host: HTMLElement, private readonly workspace: Workspace) {
    this.el = host;
    host.classList.add("ho-sheet-tabs");
    host.addEventListener("click", this.onClick);
    host.addEventListener("dblclick", this.onDbl);
    this.sync();
  }

  sync(): void {
    const state = this.workspace.formatState();
    this.el.innerHTML = `
      <div class="ho-sheet-tab-list">
        ${state.sheetNames.map((name, i) =>
          `<button type="button" class="ho-sheet-tab${i === state.activeSheet ? " is-on" : ""}" data-sheet="${i}">${escapeHtml(name)}</button>`).join("")}
      </div>
      <button type="button" class="ho-sheet-tab-add" data-act="add" title="新增工作表">+</button>
    `;
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
    if (target.dataset.sheet) {
      this.workspace.switchSheet(Number(target.dataset.sheet));
    }
  };

  private onDbl = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-sheet]");
    if (!button) {
      return;
    }
    const index = Number(button.dataset.sheet);
    const name = window.prompt("工作表名称", this.workspace.workbook.sheets[index]?.name ?? "");
    if (name) {
      this.workspace.renameSheet(index, name);
    }
  };
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
