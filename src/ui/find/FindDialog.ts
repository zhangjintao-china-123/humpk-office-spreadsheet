import type { Workspace } from "../workspace/Workspace";
import { ApplyFindReplaceCommand } from "./FindReplaceCommand";
import {
  DEFAULT_FIND_OPTIONS,
  cellSearchText,
  listFindHits,
  nextFindHitBySearch,
  replaceInCellText,
  textMatches,
  type FindHit,
  type FindLookIn,
  type FindOptions,
} from "./sheetFind";

type FindTab = "find" | "replace";

export class FindDialog {
  readonly el: HTMLElement;
  private tab: FindTab = "find";
  private options = { ...DEFAULT_FIND_OPTIONS };
  private replaceText = "";
  private optionsOpen = false;
  private hits: FindHit[] = [];
  private drag: { dx: number; dy: number } | null = null;
  private placed = false;

  constructor(private readonly workspace: Workspace) {
    this.el = document.createElement("div");
    this.el.className = "ho-sheet-find";
    this.el.hidden = true;
    this.el.innerHTML = markup();
    this.el.addEventListener("mousedown", this.onMouseDown);
    this.el.addEventListener("click", this.onClick);
    this.el.addEventListener("input", this.onInput);
    this.el.addEventListener("change", this.onInput);
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("mousemove", this.onDragMove);
    window.addEventListener("mouseup", this.onDragEnd);
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("mousemove", this.onDragMove);
    window.removeEventListener("mouseup", this.onDragEnd);
    this.close();
  }

  isOpen(): boolean {
    return !this.el.hidden;
  }

  hasFocus(): boolean {
    return this.isOpen() && this.el.contains(document.activeElement);
  }

  open(tab: FindTab = "find"): void {
    this.tab = tab;
    this.el.hidden = false;
    if (!this.el.isConnected) {
      document.body.append(this.el);
    }
    this.sync();
    this.place();
    this.focusQuery();
  }

  close(): void {
    this.el.hidden = true;
    this.el.remove();
    this.workspace.focusGrid();
  }

  findNext(backward = false): boolean {
    const options = this.readOptions();
    if (!options.query) {
      this.open(this.tab);
      this.setStatus("请输入查找内容");
      this.focusQuery();
      return false;
    }
    this.workspace.commitEdit("none");
    const hits = listFindHits(this.workspace.workbook, options);
    this.hits = hits;
    const hit = nextFindHitBySearch(hits, this.cursor(), options.searchBy, backward);
    if (!hit) {
      this.showNotFound();
      this.renderHits([]);
      return false;
    }
    this.workspace.revealCell(hit.sheetIndex, hit.ri, hit.ci);
    this.setStatus(`${hit.sheetName}!${hit.address}`);
    if (this.resultsVisible()) {
      this.renderHits(hits, hit);
    }
    this.focusQuery();
    return true;
  }

  replaceCurrent(): void {
    this.open("replace");
    const options = this.readOptions();
    if (!options.query) {
      this.setStatus("请输入查找内容");
      this.focusQuery();
      return;
    }
    this.workspace.commitEdit("none");
    if (!this.currentMatches(options)) {
      this.findNext();
      return;
    }
    const count = this.applyReplace([this.currentHit(options)!], options, false);
    if (!count) {
      this.setStatus("该单元格不可编辑");
      return;
    }
    this.findNext();
  }

  replaceAll(): void {
    this.open("replace");
    const options = this.readOptions();
    if (!options.query) {
      this.setStatus("请输入查找内容");
      this.focusQuery();
      return;
    }
    this.workspace.commitEdit("none");
    const hits = listFindHits(this.workspace.workbook, options);
    const count = this.applyReplace(hits, options, true);
    this.hits = listFindHits(this.workspace.workbook, options);
    this.renderHits(this.hits);
    if (!count) {
      this.showNotFound();
      return;
    }
    this.setStatus(`已完成 ${count} 处替换。`);
    this.focusQuery();
  }

  findAll(): void {
    const options = this.readOptions();
    if (!options.query) {
      this.setStatus("请输入查找内容");
      this.focusQuery();
      return;
    }
    this.workspace.commitEdit("none");
    const hits = listFindHits(this.workspace.workbook, options);
    this.hits = hits;
    this.renderHits(hits, hits[0]);
    if (!hits.length) {
      this.showNotFound();
      return;
    }
    this.workspace.revealCell(hits[0].sheetIndex, hits[0].ri, hits[0].ci);
    this.setStatus(`找到 ${hits.length} 个单元格`);
    this.focusQuery();
  }

  private applyReplace(hits: FindHit[], options: FindOptions, allInCell: boolean): number {
    const targets = [];
    let count = 0;
    for (const hit of hits) {
      const sheet = this.workspace.workbook.sheets[hit.sheetIndex];
      if (!sheet) {
        continue;
      }
      if (this.workspace.isFillLocked() && !sheet.hasEditable(hit.ri, hit.ci)) {
        continue;
      }
      const current = cellSearchText(sheet, hit.ri, hit.ci, options.lookIn);
      const next = replaceInCellText(current, options.query, this.replaceText, {
        matchCase: options.matchCase,
        matchEntire: options.matchEntire,
        all: allInCell,
      });
      if (!next) {
        continue;
      }
      targets.push({ sheet, ri: hit.ri, ci: hit.ci, next: next.text });
      count += next.count;
    }
    if (!targets.length) {
      return 0;
    }
    this.workspace.history.do(new ApplyFindReplaceCommand(this.workspace, targets, options.lookIn));
    return count;
  }

  private currentMatches(options: FindOptions): boolean {
    const sheet = this.workspace.sheet();
    const { ri, ci } = this.workspace.selection;
    const origin = sheet.mergeOrigin(ri, ci);
    const value = cellSearchText(sheet, origin.ri, origin.ci, options.lookIn);
    return textMatches(value, options.query, options.matchCase, options.matchEntire);
  }

  private currentHit(options: FindOptions): FindHit | undefined {
    const sheet = this.workspace.sheet();
    const origin = sheet.mergeOrigin(this.workspace.selection.ri, this.workspace.selection.ci);
    return {
      sheetIndex: this.workspace.workbook.activeIndex,
      sheetName: sheet.name,
      ri: origin.ri,
      ci: origin.ci,
      address: this.workspace.formatState().address,
      value: cellSearchText(sheet, origin.ri, origin.ci, options.lookIn),
    };
  }

  private cursor() {
    return {
      sheetIndex: this.workspace.workbook.activeIndex,
      ri: this.workspace.selection.ri,
      ci: this.workspace.selection.ci,
    };
  }

  private showNotFound(): void {
    this.setStatus("找不到要查找的内容。");
    window.alert("找不到要查找的内容。");
  }

  private readOptions(): FindOptions {
    this.options = {
      query: this.field<HTMLInputElement>("query").value,
      matchCase: this.field<HTMLInputElement>("match-case").checked,
      matchEntire: this.field<HTMLInputElement>("match-entire").checked,
      lookIn: this.field<HTMLSelectElement>("look-in").value as FindLookIn,
      searchBy: this.field<HTMLSelectElement>("search-by").value as FindOptions["searchBy"],
      within: this.field<HTMLSelectElement>("within").value as FindOptions["within"],
    };
    this.replaceText = this.field<HTMLInputElement>("replace").value;
    return this.options;
  }

  private sync(): void {
    this.el.dataset.tab = this.tab;
    this.el.classList.toggle("is-options", this.optionsOpen);
    this.el.querySelectorAll<HTMLButtonElement>("[data-find-tab]").forEach((button) => {
      button.classList.toggle("is-on", button.dataset.findTab === this.tab);
    });
    this.field<HTMLInputElement>("query").value = this.options.query;
    this.field<HTMLInputElement>("replace").value = this.replaceText;
    this.field<HTMLInputElement>("match-case").checked = this.options.matchCase;
    this.field<HTMLInputElement>("match-entire").checked = this.options.matchEntire;
    this.field<HTMLSelectElement>("look-in").value = this.options.lookIn;
    this.field<HTMLSelectElement>("search-by").value = this.options.searchBy;
    this.field<HTMLSelectElement>("within").value = this.options.within;
    this.el.querySelector("[data-find-options-label]")!.textContent = this.optionsOpen ? "选项 <<" : "选项 >>";
  }

  private renderHits(hits: FindHit[], active?: FindHit): void {
    const list = this.el.querySelector("[data-find-results]")!;
    const wrap = this.el.querySelector<HTMLElement>("[data-find-results-wrap]")!;
    wrap.hidden = hits.length === 0 && !this.resultsVisible();
    if (!hits.length) {
      list.replaceChildren();
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    list.replaceChildren();
    for (const hit of hits) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ho-sheet-find-row";
      row.dataset.sheetIndex = String(hit.sheetIndex);
      row.dataset.ri = String(hit.ri);
      row.dataset.ci = String(hit.ci);
      if (active && hit.sheetIndex === active.sheetIndex && hit.ri === active.ri && hit.ci === active.ci) {
        row.classList.add("is-on");
      }
      row.innerHTML = `<span>${escapeHtml(hit.sheetName)}</span><span>${escapeHtml(hit.address)}</span><span>${escapeHtml(hit.value)}</span>`;
      list.append(row);
    }
  }

  private resultsVisible(): boolean {
    return !this.el.querySelector<HTMLElement>("[data-find-results-wrap]")?.hidden;
  }

  private setStatus(text: string): void {
    this.el.querySelector("[data-find-status]")!.textContent = text;
  }

  private focusQuery(): void {
    window.setTimeout(() => {
      const input = this.field<HTMLInputElement>("query");
      input.focus();
      input.select();
    }, 0);
  }

  private place(): void {
    if (this.placed) {
      return;
    }
    const pad = 24;
    const width = this.el.offsetWidth || 460;
    this.el.style.left = `${Math.max(pad, window.innerWidth - width - pad)}px`;
    this.el.style.top = `${pad + 72}px`;
    this.placed = true;
  }

  private field<T extends HTMLElement>(name: string): T {
    return this.el.querySelector<T>(`[data-find-field="${name}"]`)!;
  }

  private onKey = (event: KeyboardEvent): void => {
    if (!this.isOpen()) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement) || !this.el.contains(target)) {
      return;
    }
    if (event.key !== "Enter" || target.closest("button")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.findNext(event.shiftKey);
  };

  private onMouseDown = (event: MouseEvent): void => {
    const bar = (event.target as HTMLElement).closest("[data-find-drag]");
    if (!bar || (event.target as HTMLElement).closest("button")) {
      return;
    }
    event.preventDefault();
    const rect = this.el.getBoundingClientRect();
    this.drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
  };

  private onDragMove = (event: MouseEvent): void => {
    if (!this.drag) {
      return;
    }
    this.el.style.left = `${Math.max(8, event.clientX - this.drag.dx)}px`;
    this.el.style.top = `${Math.max(8, event.clientY - this.drag.dy)}px`;
  };

  private onDragEnd = (): void => {
    this.drag = null;
  };

  private onInput = (): void => {
    this.readOptions();
  };

  private onClick = (event: Event): void => {
    const el = event.target as HTMLElement;
    const tab = el.closest<HTMLElement>("[data-find-tab]");
    if (tab?.dataset.findTab === "find" || tab?.dataset.findTab === "replace") {
      this.tab = tab.dataset.findTab;
      this.sync();
      this.focusQuery();
      return;
    }
    const row = el.closest<HTMLElement>(".ho-sheet-find-row");
    if (row) {
      this.workspace.revealCell(Number(row.dataset.sheetIndex), Number(row.dataset.ri), Number(row.dataset.ci));
      this.el.querySelectorAll(".ho-sheet-find-row").forEach((item) => item.classList.toggle("is-on", item === row));
      return;
    }
    const act = el.closest<HTMLElement>("[data-find-act]")?.dataset.findAct;
    if (act === "close") {
      this.close();
    } else if (act === "next") {
      this.findNext();
    } else if (act === "prev") {
      this.findNext(true);
    } else if (act === "all") {
      this.findAll();
    } else if (act === "replace") {
      this.replaceCurrent();
    } else if (act === "replace-all") {
      this.replaceAll();
    } else if (act === "options") {
      this.optionsOpen = !this.optionsOpen;
      this.sync();
    }
  };
}

function markup(): string {
  return `
    <div class="ho-sheet-find-bar" data-find-drag>
      <div class="ho-sheet-find-title">查找和替换</div>
      <button type="button" data-find-act="close" title="关闭">×</button>
    </div>
    <div class="ho-sheet-find-tabs">
      <button type="button" data-find-tab="find">查找</button>
      <button type="button" data-find-tab="replace">替换</button>
    </div>
    <div class="ho-sheet-find-body">
      <div class="ho-sheet-find-form">
        <label>查找内容
          <input data-find-field="query" type="text" autocomplete="off" />
        </label>
        <label class="ho-sheet-find-replace-row">替换为
          <input data-find-field="replace" type="text" autocomplete="off" />
        </label>
        <div class="ho-sheet-find-options">
          <label>范围
            <select data-find-field="within">
              <option value="sheet">工作表</option>
              <option value="workbook">工作簿</option>
            </select>
          </label>
          <label>搜索
            <select data-find-field="search-by">
              <option value="rows">按行</option>
              <option value="columns">按列</option>
            </select>
          </label>
          <label>查找范围
            <select data-find-field="look-in">
              <option value="values">值</option>
              <option value="formulas">公式</option>
              <option value="comments">批注</option>
            </select>
          </label>
          <label class="ho-sheet-find-check"><input data-find-field="match-case" type="checkbox" />区分大小写</label>
          <label class="ho-sheet-find-check"><input data-find-field="match-entire" type="checkbox" />单元格匹配</label>
        </div>
      </div>
      <div class="ho-sheet-find-actions">
        <button type="button" data-find-act="next" class="is-primary">查找下一个</button>
        <button type="button" data-find-act="prev">查找上一个</button>
        <button type="button" data-find-act="all">查找全部</button>
        <button type="button" data-find-act="replace" class="ho-sheet-find-replace-row">替换</button>
        <button type="button" data-find-act="replace-all" class="ho-sheet-find-replace-row">全部替换</button>
        <button type="button" data-find-act="options" data-find-options-label>选项 >></button>
        <button type="button" data-find-act="close">关闭</button>
      </div>
    </div>
    <div class="ho-sheet-find-status" data-find-status></div>
    <div class="ho-sheet-find-results" data-find-results-wrap hidden>
      <div class="ho-sheet-find-results-head"><span>工作表</span><span>单元格</span><span>值</span></div>
      <div class="ho-sheet-find-results-body" data-find-results></div>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
