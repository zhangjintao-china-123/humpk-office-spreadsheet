import {
  FORMULA_GROUP_ORDER,
  formulasInGroup,
  type FormulaItem,
} from "../../formula/FormulaInsert";
import type { BorderMode, FormatAction } from "../../edit/FormatAction";
import type { FormatState } from "../workspace/Workspace";
import { COMMA_FORMAT, CURRENCY_FORMATS, NUMBER_FORMATS, PERCENT_FORMAT, formatPresetId } from "../../model/NumberFormat";
import { borderIcon, borderItem } from "./BorderIcon";
import { colorPaletteMarkup, normalizeHex } from "./ColorPalette";
import { noteMarkMenuMarkup } from "./MarkPalette";
import { cssFontFamily } from "../../model/FontFamily";
import { ensureFontOption, fontSelectMarkup } from "./Fonts";
import { RibbonIcons, ribbonButton } from "./RibbonIcons";

const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 36, 48];

export interface RibbonActions {
  applyFormat(action: FormatAction): void;
  applyBorder(mode: BorderMode): void;
  undo(): void;
  redo(): void;
  newBlank(): void;
  openFile(): void;
  saveFile(): void;
  importFile(): void;
  exportFile(): void;
  loadTemplate?: () => void;
  print(): void;
  find?: () => void;
  openReplace?: () => void;
  merge(): void;
  unmerge(): void;
  insertImage(): void;
  deleteImage(): void;
  toggleAutoFilter(): void;
  toggleFreeze(): void;
  insertFunction(name: string): void;
  togglePaintFormat(): void;
  setSelectionPriority(priority: number): void;
  setSelectionShape(shape: string): void;
  setSelectionVerdict(verdict: string): void;
  clearSelectionPriority(): void;
  clearSelectionShape(): void;
  unmarkSelection(): void;
  clearSheetMarks(): void;
  editNote(): void;
  deleteNote(): void;
  appendRowsBelow(): void;
  formatState(): FormatState;
  setEditControlEnabled?(on: boolean): void;
  setSelectionTextEdit?(): void;
  requestDropdownOptions?(): void;
  setSelectionSwitch?(): void;
  clearSelectionEditable?(): void;
}

export class Ribbon {
  readonly el: HTMLElement;
  private readonly templateMode: boolean;

  constructor(host: HTMLElement, private readonly actions: RibbonActions, options?: { templateMode?: boolean }) {
    this.el = host;
    this.templateMode = options?.templateMode === true;
    host.classList.add("ho-sheet-ribbon");
    host.innerHTML = this.markup();
    host.addEventListener("mousedown", this.onMouseDown);
    host.addEventListener("click", this.onClick);
    host.addEventListener("change", this.onChange);
    document.addEventListener("mousedown", this.onDocumentMouseDown, true);
    this.sync();
  }

  destroy(): void {
    document.removeEventListener("mousedown", this.onDocumentMouseDown, true);
  }

  sync(): void {
    const state = this.actions.formatState();
    this.toggle("bold", state.bold);
    this.toggle("italic", state.italic);
    this.toggle("underline", state.underline);
    this.toggle("strike", state.strike);
    this.toggle("textwrap", state.textwrap);
    this.toggle("align-left", state.align === "left");
    this.toggle("align-center", state.align === "center");
    this.toggle("align-right", state.align === "right");
    this.toggle("valign-top", state.valign === "top");
    this.toggle("valign-middle", state.valign === "middle");
    this.toggle("valign-bottom", state.valign === "bottom");
    this.toggle("autofilter", state.autoFilter);
    this.toggle("freeze", state.freeze);
    this.toggle("paintformat", state.paintFormat);
    this.el.querySelector("[data-mark-toggle=note-mark]")?.classList.toggle("is-on", !!(state.selectionPriority || state.selectionShape || state.selectionVerdict || state.selectionHasNote));
    this.setDisabled("unmark", state.markCount === 0);
    this.setDisabled("unmark-sheet", state.markCount === 0);
    this.setDisabled("delete-note", !state.selectionHasNote);
    this.markSelectedChip("priority", state.selectionPriority ? String(state.selectionPriority) : "");
    this.markSelectedChip("shape", state.selectionShape ?? "");
    this.markSelectedChip("verdict", state.selectionVerdict ?? "");
    this.setDisabled("undo", !state.canUndo);
    this.setDisabled("redo", !state.canRedo);
    this.toggle("edit-control", state.editControl);
    this.toggle("control-text", state.editControl && state.selectionEditable && !state.cellControl);
    this.toggle("control-dropdown", state.cellControl === "dropdown");
    this.toggle("control-switch", state.cellControl === "switch");
    this.setDisabled("control-text", !state.editControl);
    this.setDisabled("control-dropdown", !state.editControl);
    this.setDisabled("control-switch", !state.editControl);
    this.setDisabled("deny-edit", !state.editControl);
    const font = this.el.querySelector<HTMLSelectElement>("[data-select=font]");
    const size = this.el.querySelector<HTMLSelectElement>("[data-select=size]");
    const numFmt = this.el.querySelector<HTMLSelectElement>("[data-select=numfmt]");
    if (font) {
      ensureFontOption(font, state.fontFamily);
      font.value = state.fontFamily;
      font.style.fontFamily = cssFontFamily(state.fontFamily);
    }
    if (size) {
      size.value = String(SIZES.includes(state.fontSizePt) ? state.fontSizePt : 10);
    }
    if (numFmt) {
      const preset = formatPresetId(state.numFmt);
      const match = NUMBER_FORMATS.find((item) => item.id === preset);
      numFmt.value = match?.code ?? "__custom__";
    }
    const caption = this.el.querySelector("[data-caption]");
    if (caption) {
      caption.textContent = state.caption;
    }
    const meta = this.el.querySelector("[data-meta]");
    if (meta) {
      meta.replaceChildren();
      for (const item of state.captionMeta ?? []) {
        const chip = document.createElement("span");
        chip.className = "ho-sheet-meta-item";
        const label = document.createElement("span");
        label.className = "ho-sheet-meta-label";
        label.textContent = item.label;
        const value = document.createElement("span");
        value.className = "ho-sheet-meta-value";
        value.textContent = item.value;
        chip.append(label, value);
        meta.append(chip);
      }
    }
    const color = this.el.querySelector<HTMLElement>("[data-swatch=color]");
    if (color) {
      color.style.background = state.color;
    }
    const fill = this.el.querySelector<HTMLElement>("[data-swatch=fill]");
    if (fill) {
      fill.style.background = state.bgcolor;
    }
    this.markSelectedSwatch("color", state.color);
    this.markSelectedSwatch("fill", state.bgcolor);
  }

  private onMouseDown = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (target.closest("select, option, input, textarea, [data-caption], [data-meta], [data-more-color]")) {
      return;
    }
    event.preventDefault();
  };

  private onDocumentMouseDown = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof Node && this.el.contains(target)) {
      return;
    }
    this.closeDrops();
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.el.contains(active)) {
      active.blur();
    }
  };

  private onClick = (event: Event): void => {
    const el = event.target as HTMLElement;
    const more = el.closest<HTMLElement>("[data-more-color]");
    if (more?.dataset.moreColor) {
      this.openMoreColor(more.dataset.moreColor as "color" | "fill");
      return;
    }
    const chip = el.closest<HTMLElement>("[data-color], [data-fill], [data-border], [data-priority], [data-shape], [data-verdict], [data-clear-priority], [data-clear-shape]");
    if (chip?.dataset.color) {
      this.actions.applyFormat({ type: "color", value: chip.dataset.color });
      this.closeDrops();
      this.sync();
      return;
    }
    if (chip?.dataset.fill) {
      this.actions.applyFormat({ type: "bgcolor", value: chip.dataset.fill });
      this.closeDrops();
      this.sync();
      return;
    }
    if (chip?.dataset.border) {
      this.actions.applyBorder(chip.dataset.border as BorderMode);
      this.closeDrops();
      this.sync();
      return;
    }
    if (chip?.dataset.priority) {
      this.actions.setSelectionPriority(Number(chip.dataset.priority));
      this.closeDrops();
      this.sync();
      return;
    }
    if (chip?.dataset.shape) {
      this.actions.setSelectionShape(chip.dataset.shape);
      this.closeDrops();
      this.sync();
      return;
    }
    if (chip?.dataset.verdict) {
      this.actions.setSelectionVerdict(chip.dataset.verdict);
      this.closeDrops();
      this.sync();
      return;
    }
    if (chip?.hasAttribute("data-clear-priority")) {
      this.actions.clearSelectionPriority();
      this.closeDrops();
      this.sync();
      return;
    }
    if (chip?.hasAttribute("data-clear-shape")) {
      this.actions.clearSelectionShape();
      this.closeDrops();
      this.sync();
      return;
    }
    const numFmt = el.closest<HTMLElement>("[data-numfmt]");
    if (numFmt?.dataset.numfmt) {
      this.actions.applyFormat({ type: "numFmt", value: numFmt.dataset.numfmt });
      this.closeDrops();
      this.sync();
      return;
    }
    const fn = el.closest<HTMLElement>("[data-formula]");
    if (fn?.dataset.formula) {
      this.actions.insertFunction(fn.dataset.formula);
      this.closeDrops();
      this.sync();
      return;
    }
    const caption = el.closest<HTMLElement>("[data-caption]");
    if (caption) {
      this.selectCaption(caption);
      return;
    }
    const tab = el.closest<HTMLElement>("[data-ribbon-tab]");
    if (tab?.dataset.ribbonTab) {
      this.switchTab(tab.dataset.ribbonTab);
      this.closeDrops();
      return;
    }
    const toggle = el.closest<HTMLElement>("[data-drop-toggle]");
    if (toggle) {
      const drop = toggle.closest(".ho-sheet-drop");
      const open = drop?.classList.contains("is-open");
      this.closeDrops();
      drop?.classList.toggle("is-open", !open);
      return;
    }
    this.closeDrops();
    const target = el.closest<HTMLElement>("[data-act]");
    if (!target) {
      return;
    }
    const act = target.dataset.act;
    if (act === "undo") {
      this.actions.undo();
    } else if (act === "redo") {
      this.actions.redo();
    } else if (act === "new") {
      this.actions.newBlank();
    } else if (act === "open") {
      this.actions.openFile();
    } else if (act === "save") {
      this.actions.saveFile();
    } else if (act === "import") {
      this.actions.importFile();
    } else if (act === "load-template") {
      this.actions.loadTemplate?.();
    } else if (act === "export") {
      this.actions.exportFile();
    } else if (act === "print") {
      this.actions.print();
    } else if (act === "find") {
      this.actions.find?.();
    } else if (act === "replace") {
      this.actions.openReplace?.();
    } else if (act === "merge") {
      this.actions.merge();
    } else if (act === "unmerge") {
      this.actions.unmerge();
    } else if (act === "insert-image") {
      this.actions.insertImage();
    } else if (act === "delete-image") {
      this.actions.deleteImage();
    } else if (act === "autofilter") {
      this.actions.toggleAutoFilter();
    } else if (act === "freeze") {
      this.actions.toggleFreeze();
    } else if (act === "paintformat") {
      this.actions.togglePaintFormat();
    } else if (act === "unmark") {
      this.actions.unmarkSelection();
    } else if (act === "unmark-sheet") {
      this.actions.clearSheetMarks();
    } else if (act === "note" || act === "edit-note") {
      this.actions.editNote();
    } else if (act === "delete-note") {
      this.actions.deleteNote();
    } else if (act === "append-row") {
      this.actions.appendRowsBelow();
    } else if (act === "bold" || act === "italic" || act === "underline" || act === "strike" || act === "clear" || act === "textwrap") {
      this.actions.applyFormat({ type: act });
    } else if (act === "align-left" || act === "align-center" || act === "align-right") {
      this.actions.applyFormat({ type: "align", value: act.replace("align-", "") as "left" | "center" | "right" });
    } else if (act === "valign-top" || act === "valign-middle" || act === "valign-bottom") {
      this.actions.applyFormat({ type: "valign", value: act.replace("valign-", "") as "top" | "middle" | "bottom" });
    } else if (act === "num-percent") {
      this.actions.applyFormat({ type: "numFmt", value: PERCENT_FORMAT });
    } else if (act === "num-comma") {
      this.actions.applyFormat({ type: "numFmt", value: COMMA_FORMAT });
    } else if (act === "dec-more") {
      this.actions.applyFormat({ type: "decimal", value: 1 });
    } else if (act === "dec-less") {
      this.actions.applyFormat({ type: "decimal", value: -1 });
    } else if (act === "edit-control") {
      this.actions.setEditControlEnabled?.(!this.actions.formatState().editControl);
    } else if (act === "control-text") {
      this.actions.setSelectionTextEdit?.();
    } else if (act === "control-dropdown") {
      this.actions.requestDropdownOptions?.();
    } else if (act === "control-switch") {
      this.actions.setSelectionSwitch?.();
    } else if (act === "deny-edit") {
      this.actions.clearSelectionEditable?.();
    }
    this.sync();
  };

  private onChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    if (select.dataset.select === "font") {
      this.actions.applyFormat({ type: "fontFamily", value: select.value });
    }
    if (select.dataset.select === "size") {
      this.actions.applyFormat({ type: "fontSizePt", value: Number(select.value) });
    }
    if (select.dataset.select === "numfmt" && select.value !== "__custom__") {
      this.actions.applyFormat({ type: "numFmt", value: select.value });
    }
    const colorInput = event.target as HTMLInputElement;
    if (colorInput.dataset.colorInput === "color" || colorInput.dataset.colorInput === "fill") {
      const value = colorInput.value;
      this.actions.applyFormat({
        type: colorInput.dataset.colorInput === "fill" ? "bgcolor" : "color",
        value,
      });
      this.closeDrops();
    }
    this.sync();
  };

  private selectCaption(caption: HTMLElement): void {
    const range = document.createRange();
    range.selectNodeContents(caption);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  private switchTab(name: string): void {
    this.el.querySelectorAll("[data-ribbon-tab]").forEach((button) => {
      button.classList.toggle("is-on", button.getAttribute("data-ribbon-tab") === name);
    });
    this.el.querySelector(".ho-sheet-ribbon-home")?.classList.toggle("is-on", name === "home");
    this.el.querySelector(".ho-sheet-ribbon-formula")?.classList.toggle("is-on", name === "formula");
    this.el.querySelector(".ho-sheet-ribbon-options")?.classList.toggle("is-on", name === "options");
  }

  private closeDrops(): void {
    this.el.querySelectorAll(".ho-sheet-drop.is-open").forEach((drop) => drop.classList.remove("is-open"));
  }

  private openMoreColor(kind: "color" | "fill"): void {
    const input = this.el.querySelector<HTMLInputElement>(`[data-color-input="${kind}"]`);
    if (!input) {
      return;
    }
    const state = this.actions.formatState();
    input.value = normalizeHex(kind === "fill" ? state.bgcolor : state.color) || "#000000";
    input.click();
  }

  private markSelectedSwatch(kind: "color" | "fill", value: string): void {
    const attr = kind === "color" ? "data-color" : "data-fill";
    const current = normalizeHex(value);
    this.el.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((button) => {
      button.classList.toggle("is-selected", normalizeHex(button.getAttribute(attr) ?? "") === current);
    });
  }

  private markSelectedChip(kind: "priority" | "shape" | "verdict", value: string): void {
    const attr = kind === "priority" ? "data-priority" : kind === "shape" ? "data-shape" : "data-verdict";
    this.el.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((button) => {
      button.classList.toggle("is-selected", (button.getAttribute(attr) ?? "") === value);
    });
  }

  private toggle(act: string, on: boolean): void {
    this.el.querySelector(`[data-act="${act}"]`)?.classList.toggle("is-on", on);
  }

  private setDisabled(act: string, disabled: boolean): void {
    const button = this.el.querySelector<HTMLButtonElement>(`[data-act="${act}"]`);
    if (button) {
      button.disabled = disabled;
    }
  }

  private markup(): string {
    return `
      <div class="ho-sheet-ribbon-title">
        <div class="ho-sheet-brand">表格</div>
        <div class="ho-sheet-tabs-label">
          <button type="button" data-ribbon-tab="home" class="is-on">开始</button>
          <button type="button" data-ribbon-tab="formula">公式</button>
          ${this.templateMode ? `<button type="button" data-ribbon-tab="options">选项</button>` : ""}
        </div>
        <div class="ho-sheet-meta" data-meta></div>
        <div class="ho-sheet-save-status" data-save-status></div>
        <div class="ho-sheet-caption" data-caption tabindex="0" title="点击选中后可复制">未命名工作簿</div>
      </div>
      <div class="ho-sheet-ribbon-home is-on">
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body">
            <div class="ho-sheet-row">
              ${ribbonButton("new", "新建", RibbonIcons.fileNew)}
              ${ribbonButton("open", "打开 JSON", RibbonIcons.fileOpen)}
              ${ribbonButton("save", "保存 JSON", RibbonIcons.fileSave)}
              ${ribbonButton("import", "导入 Excel", RibbonIcons.fileImport)}
              ${this.actions.loadTemplate ? ribbonButton("load-template", "加载模版", RibbonIcons.fileTemplate) : ""}
              ${ribbonButton("export", "导出 Excel", RibbonIcons.fileExport)}
            </div>
            <div class="ho-sheet-row">
              ${ribbonButton("undo", "撤销", RibbonIcons.undo)}
              ${ribbonButton("redo", "重做", RibbonIcons.redo)}
              ${ribbonButton("paintformat", "格式刷", RibbonIcons.paint)}
              ${ribbonButton("print", "打印 (Ctrl+P)", RibbonIcons.print)}
              ${ribbonButton("find", "查找 (Ctrl+F)", RibbonIcons.find)}
            </div>
          </div>
          <span>文件</span>
        </section>
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body ho-sheet-font">
            <div class="ho-sheet-row">
              <select data-select="font">${fontSelectMarkup()}</select>
              <select data-select="size">${SIZES.map((size) => `<option value="${size}">${size}</option>`).join("")}</select>
            </div>
            <div class="ho-sheet-row">
              ${ribbonButton("bold", "加粗", RibbonIcons.bold)}
              ${ribbonButton("italic", "倾斜", RibbonIcons.italic)}
              ${ribbonButton("underline", "下划线", RibbonIcons.underline)}
              ${ribbonButton("strike", "删除线", RibbonIcons.strike)}
              <div class="ho-sheet-drop">
                <button type="button" data-drop-toggle title="字体颜色">${RibbonIcons.color}<span data-swatch="color"></span></button>
                ${colorPaletteMarkup("color")}
              </div>
              <div class="ho-sheet-drop">
                <button type="button" data-drop-toggle title="填充">${RibbonIcons.fill}<span data-swatch="fill"></span></button>
                ${colorPaletteMarkup("fill")}
              </div>
              <div class="ho-sheet-drop">
                <button type="button" data-drop-toggle title="边框" class="ho-sheet-border-btn">${borderIcon("all")}</button>
                <div class="ho-sheet-border-menu">
                  ${borderItem("all", "全框线")}
                  ${borderItem("outside", "外边框")}
                  ${borderItem("inside", "内框线")}
                  ${borderItem("none", "无框线")}
                  ${borderItem("top", "上框线")}
                  ${borderItem("bottom", "下框线")}
                  ${borderItem("left", "左框线")}
                  ${borderItem("right", "右框线")}
                </div>
              </div>
              ${ribbonButton("clear", "清除格式", RibbonIcons.clear)}
            </div>
          </div>
          <span>字体</span>
        </section>
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body">
            <div class="ho-sheet-row">
              ${ribbonButton("valign-top", "顶端对齐", RibbonIcons.valignTop)}
              ${ribbonButton("valign-middle", "垂直居中", RibbonIcons.valignMiddle)}
              ${ribbonButton("valign-bottom", "底端对齐", RibbonIcons.valignBottom)}
              ${ribbonButton("textwrap", "自动换行", RibbonIcons.wrap)}
            </div>
            <div class="ho-sheet-row">
              ${ribbonButton("align-left", "左对齐", RibbonIcons.alignLeft)}
              ${ribbonButton("align-center", "居中", RibbonIcons.alignCenter)}
              ${ribbonButton("align-right", "右对齐", RibbonIcons.alignRight)}
              ${ribbonButton("merge", "合并单元格", RibbonIcons.merge)}
              ${ribbonButton("unmerge", "取消合并", RibbonIcons.unmerge)}
            </div>
          </div>
          <span>对齐</span>
        </section>
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body ho-sheet-number">
            <div class="ho-sheet-row">
              <select data-select="numfmt" title="数字格式">
                ${NUMBER_FORMATS.map((item) => `<option value="${escapeAttr(item.code)}">${item.label}</option>`).join("")}
                <option value="__custom__" hidden>自定义</option>
              </select>
            </div>
            <div class="ho-sheet-row">
              <div class="ho-sheet-drop">
                <button type="button" data-drop-toggle title="会计数字格式" class="ho-sheet-currency-btn">${RibbonIcons.currency}${RibbonIcons.chevron}</button>
                <div class="ho-sheet-border-menu">
                  ${CURRENCY_FORMATS.map((item) => `<button type="button" data-numfmt="${escapeAttr(item.code)}">${item.label}</button>`).join("")}
                </div>
              </div>
              ${ribbonButton("num-percent", "百分比样式", RibbonIcons.percent)}
              ${ribbonButton("num-comma", "千位分隔样式", RibbonIcons.comma)}
              <span class="ho-sheet-split"></span>
              ${ribbonButton("dec-more", "增加小数位数", RibbonIcons.decMore)}
              ${ribbonButton("dec-less", "减少小数位数", RibbonIcons.decLess)}
            </div>
          </div>
          <span>数字</span>
        </section>
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body">
            <div class="ho-sheet-row">
              ${ribbonButton("insert-image", "插入浮动图片", RibbonIcons.image)}
              ${ribbonButton("delete-image", "删除选中图片", RibbonIcons.imageOff)}
            </div>
            <div class="ho-sheet-row">
              ${ribbonButton("autofilter", "自动筛选", RibbonIcons.filter)}
              ${ribbonButton("freeze", "冻结窗格", RibbonIcons.freeze)}
              <div class="ho-sheet-drop">
                <button type="button" data-drop-toggle data-mark-toggle="note-mark" title="备注和标记">${RibbonIcons.note}</button>
                ${noteMarkMenuMarkup()}
              </div>
              ${ribbonButton("append-row", "在下方追加行", RibbonIcons.appendRow)}
            </div>
          </div>
          <span>单元格</span>
        </section>
      </div>
      <div class="ho-sheet-ribbon-formula">
        <section class="ho-sheet-group ho-sheet-formula-lib">
          <div class="ho-sheet-group-body ho-sheet-formula-cats">
            ${formulaCategory("插入函数", RibbonIcons.fx, allFormulaMenu(), "wide")}
            <button type="button" data-formula="SUM" title="SUM" class="ho-sheet-formula-autosum">
              ${RibbonIcons.sigma}<span>自动求和</span>
            </button>
            ${formulaCategory("统计", RibbonIcons.average, formulaMenuItems(formulasInGroup("常用")))}
            ${formulaCategory("逻辑", RibbonIcons.logic, formulaMenuItems(formulasInGroup("逻辑")))}
            ${formulaCategory("文本", RibbonIcons.textA, formulaMenuItems(formulasInGroup("文本")))}
            ${formulaCategory("日期和时间", RibbonIcons.date, formulaMenuItems(formulasInGroup("日期")))}
            ${formulaCategory("查找和引用", RibbonIcons.lookup, formulaMenuItems(formulasInGroup("查找")))}
            ${formulaCategory("数学", RibbonIcons.math, formulaMenuItems(formulasInGroup("数学")))}
            ${formulaCategory("其他函数", RibbonIcons.more, otherFormulaMenu())}
          </div>
          <span>函数库</span>
        </section>
      </div>
      ${this.templateMode ? `
      <div class="ho-sheet-ribbon-options">
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body ho-sheet-options-cmds">
            ${ribbonCmd("edit-control", "开启后，用该模版新建或加载的表格才会限制只能改可编辑格", "编辑控制", RibbonIcons.editControl)}
          </div>
          <span>使用模版时</span>
        </section>
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body ho-sheet-options-cmds">
            ${ribbonCmd("control-text", "文本输入", "文本输入", RibbonIcons.textA)}
            ${ribbonCmd("control-dropdown", "下拉列表", "下拉列表", RibbonIcons.controlDropdown)}
            ${ribbonCmd("control-switch", "开关", "开关", RibbonIcons.controlSwitch)}
            ${ribbonCmd("deny-edit", "取消可编辑", "取消可编辑", RibbonIcons.denyEdit)}
          </div>
          <span>单元格控件</span>
        </section>
      </div>
      ` : ""}
    `;
  }
}

function ribbonCmd(act: string, title: string, label: string, svg: string): string {
  return `<button type="button" data-act="${act}" title="${title}" class="ho-sheet-ribbon-cmd">${svg}<span>${label}</span></button>`;
}

function formulaCategory(title: string, icon: string, menu: string, wide?: "wide"): string {
  return `
    <div class="ho-sheet-drop ho-sheet-formula-cat${wide ? " is-wide" : ""}">
      <button type="button" data-drop-toggle title="${title}">
        ${icon}<span>${title}</span>
      </button>
      <div class="ho-sheet-formula-menu">${menu}</div>
    </div>
  `;
}

function formulaMenuItems(items: FormulaItem[]): string {
  if (!items.length) {
    return `<div class="ho-sheet-formula-empty">暂无</div>`;
  }
  return items
    .map(
      (item) =>
        `<button type="button" data-formula="${item.name}" title="${item.name} ${item.label}"><span>${item.name}</span><em>${item.label === item.name ? "" : item.label}</em></button>`,
    )
    .join("");
}

function allFormulaMenu(): string {
  return FORMULA_GROUP_ORDER.map((group) => {
    const items = formulasInGroup(group);
    if (!items.length) return "";
    return `<div class="ho-sheet-formula-heading">${group}</div>${formulaMenuItems(items)}`;
  }).join("");
}

function otherFormulaMenu(): string {
  return `<div class="ho-sheet-formula-heading">条件</div>${formulaMenuItems(formulasInGroup("条件"))}`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
