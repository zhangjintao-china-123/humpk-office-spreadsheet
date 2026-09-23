import type { Workspace } from "../workspace/Workspace";
import { formatSelectionStats, selectionStatsForRanges } from "./selectionStats";

export class StatusBar {
  readonly el: HTMLElement;
  private readonly modeEl: HTMLElement;
  private readonly rangeEl: HTMLElement;
  private readonly statsEl: HTMLElement;

  constructor(host: HTMLElement, private readonly workspace: Workspace) {
    this.el = host;
    host.classList.add("ho-sheet-statusbar");
    host.innerHTML = `
      <div class="ho-sheet-statusbar-left">
        <span data-status-mode>就绪</span>
        <span class="ho-sheet-save-status" data-save-status></span>
        <span data-status-range></span>
      </div>
      <div class="ho-sheet-statusbar-right" data-status-stats></div>
    `;
    this.modeEl = host.querySelector("[data-status-mode]")!;
    this.rangeEl = host.querySelector("[data-status-range]")!;
    this.statsEl = host.querySelector("[data-status-stats]")!;
    this.sync();
  }

  sync(): void {
    const locked = this.workspace.isFillLocked() && !this.workspace.canEditCell();
    const fillEditable = this.workspace.isFillLocked() && this.workspace.canEditCell();
    this.modeEl.textContent = statusMode(this.workspace);
    this.modeEl.classList.toggle("is-locked", locked);
    this.modeEl.classList.toggle("is-editable", fillEditable);
    this.modeEl.title = locked
      ? "此格由模版锁定，不可修改"
      : fillEditable
        ? controlHint(this.workspace)
        : "";
    const ranges = this.workspace.selection.ranges();
    this.rangeEl.textContent = ranges.length > 1 || ranges[0]?.multiple()
      ? ranges.map((range) => range.toString()).join(",")
      : "";
    const parts = formatSelectionStats(selectionStatsForRanges(this.workspace.sheet(), ranges));
    this.statsEl.replaceChildren(
      ...parts.map((text, index) => {
        const item = document.createElement("span");
        item.className = "ho-sheet-statusbar-stat";
        item.textContent = text;
        if (index > 0) {
          item.classList.add("is-split");
        }
        return item;
      }),
    );
  }
}

function statusMode(workspace: Workspace): string {
  if (workspace.formulaSession?.mode === "point") {
    return "输入";
  }
  if (workspace.editing || workspace.formulaSession) {
    return "编辑";
  }
  if (workspace.editControlEnabled()) {
    const control = workspace.formatState().cellControl;
    if (control === "dropdown") {
      return "下拉";
    }
    if (control === "switch") {
      return "开关";
    }
    if (workspace.sheet().hasEditable(workspace.selection.ri, workspace.selection.ci)) {
      return "可编辑";
    }
    return "就绪";
  }
  if (workspace.templateMode) {
    return "就绪";
  }
  if (workspace.isFillLocked()) {
    if (!workspace.canEditCell()) {
      return "模版锁定，不可编辑";
    }
    const control = workspace.formatState().cellControl;
    if (control === "dropdown") {
      return "下拉";
    }
    if (control === "switch") {
      return "开关";
    }
    return "可编辑";
  }
  return "就绪";
}

function controlHint(workspace: Workspace): string {
  const control = workspace.formatState().cellControl;
  if (control === "dropdown") {
    return "此格为下拉列表，点右侧箭头选择";
  }
  if (control === "switch") {
    return "此格为开关，点击切换";
  }
  return "此格已标记为可编辑";
}
