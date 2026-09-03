import type { BorderMode, FormatAction } from "../../edit/FormatAction";
import type { FormatState } from "../workspace/Workspace";
import { borderIcon, borderItem } from "./BorderIcon";
import { RibbonIcons, ribbonButton } from "./RibbonIcons";

const FONTS = ["Arial", "Calibri", "宋体", "黑体", "微软雅黑", "Times New Roman"];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 36, 48];
const TEXT_COLORS = ["#111111", "#C00000", "#FF0000", "#ED7D31", "#FFC000", "#70AD47", "#00B0F0", "#0070C0", "#7030A0", "#FFFFFF"];
const FILLS = ["none", "#FFFF00", "#00FF00", "#00FFFF", "#FFC7CE", "#C6EFCE", "#FFEB9C", "#D9D9D9", "#9BC2E6", "#FFFFFF"];

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
  print(): void;
  merge(): void;
  unmerge(): void;
  insertImage(): void;
  deleteImage(): void;
  toggleAutoFilter(): void;
  toggleFreeze(): void;
  insertFunction(name: string): void;
  togglePaintFormat(): void;
  formatState(): FormatState;
}

export class Ribbon {
  readonly el: HTMLElement;

  constructor(host: HTMLElement, private readonly actions: RibbonActions) {
    this.el = host;
    host.classList.add("ho-sheet-ribbon");
    host.innerHTML = this.markup();
    host.addEventListener("mousedown", this.onMouseDown);
    host.addEventListener("click", this.onClick);
    host.addEventListener("change", this.onChange);
    this.sync();
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
    this.setDisabled("undo", !state.canUndo);
    this.setDisabled("redo", !state.canRedo);
    const font = this.el.querySelector<HTMLSelectElement>("[data-select=font]");
    const size = this.el.querySelector<HTMLSelectElement>("[data-select=size]");
    if (font) {
      font.value = FONTS.includes(state.fontFamily) ? state.fontFamily : FONTS[0];
    }
    if (size) {
      size.value = String(SIZES.includes(state.fontSizePt) ? state.fontSizePt : 10);
    }
    const caption = this.el.querySelector("[data-caption]");
    if (caption) {
      caption.textContent = state.caption;
    }
    const color = this.el.querySelector<HTMLElement>("[data-swatch=color]");
    if (color) {
      color.style.background = state.color;
    }
    const fill = this.el.querySelector<HTMLElement>("[data-swatch=fill]");
    if (fill) {
      fill.style.background = state.bgcolor;
    }
  }

  private onMouseDown = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (target.closest("select, option, input, textarea")) {
      return;
    }
    event.preventDefault();
  };

  private onClick = (event: Event): void => {
    const el = event.target as HTMLElement;
    const chip = el.closest<HTMLElement>("[data-color], [data-fill], [data-border]");
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
    const fn = el.closest<HTMLElement>("[data-formula]");
    if (fn?.dataset.formula) {
      this.actions.insertFunction(fn.dataset.formula);
      this.closeDrops();
      this.sync();
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
    } else if (act === "export") {
      this.actions.exportFile();
    } else if (act === "print") {
      this.actions.print();
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
    } else if (act === "bold" || act === "italic" || act === "underline" || act === "strike" || act === "clear" || act === "textwrap") {
      this.actions.applyFormat({ type: act });
    } else if (act === "align-left" || act === "align-center" || act === "align-right") {
      this.actions.applyFormat({ type: "align", value: act.replace("align-", "") as "left" | "center" | "right" });
    } else if (act === "valign-top" || act === "valign-middle" || act === "valign-bottom") {
      this.actions.applyFormat({ type: "valign", value: act.replace("valign-", "") as "top" | "middle" | "bottom" });
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
    this.sync();
  };

  private switchTab(name: string): void {
    this.el.querySelectorAll("[data-ribbon-tab]").forEach((button) => {
      button.classList.toggle("is-on", button.getAttribute("data-ribbon-tab") === name);
    });
    this.el.querySelector(".ho-sheet-ribbon-home")?.classList.toggle("is-on", name === "home");
    this.el.querySelector(".ho-sheet-ribbon-formula")?.classList.toggle("is-on", name === "formula");
  }

  private closeDrops(): void {
    this.el.querySelectorAll(".ho-sheet-drop.is-open").forEach((drop) => drop.classList.remove("is-open"));
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
        <div class="ho-sheet-brand">humpk-office</div>
        <div class="ho-sheet-tabs-label">
          <button type="button" data-ribbon-tab="home" class="is-on">开始</button>
          <button type="button" data-ribbon-tab="formula">公式</button>
        </div>
        <div class="ho-sheet-caption" data-caption>未命名工作簿</div>
      </div>
      <div class="ho-sheet-ribbon-home is-on">
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body">
            <div class="ho-sheet-row">
              ${ribbonButton("new", "新建", RibbonIcons.fileNew)}
              ${ribbonButton("open", "打开 JSON", RibbonIcons.fileOpen)}
              ${ribbonButton("save", "保存 JSON", RibbonIcons.fileSave)}
              ${ribbonButton("import", "导入 Excel", RibbonIcons.fileImport)}
              ${ribbonButton("export", "导出 Excel", RibbonIcons.fileExport)}
            </div>
            <div class="ho-sheet-row">
              ${ribbonButton("undo", "撤销", RibbonIcons.undo)}
              ${ribbonButton("redo", "重做", RibbonIcons.redo)}
              ${ribbonButton("paintformat", "格式刷", RibbonIcons.paint)}
              ${ribbonButton("print", "打印 (Ctrl+P)", RibbonIcons.print)}
            </div>
          </div>
          <span>文件</span>
        </section>
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body ho-sheet-font">
            <div class="ho-sheet-row">
              <select data-select="font">${FONTS.map((font) => `<option value="${font}">${font}</option>`).join("")}</select>
              <select data-select="size">${SIZES.map((size) => `<option value="${size}">${size}</option>`).join("")}</select>
            </div>
            <div class="ho-sheet-row">
              ${ribbonButton("bold", "加粗", RibbonIcons.bold)}
              ${ribbonButton("italic", "倾斜", RibbonIcons.italic)}
              ${ribbonButton("underline", "下划线", RibbonIcons.underline)}
              ${ribbonButton("strike", "删除线", RibbonIcons.strike)}
              <div class="ho-sheet-drop">
                <button type="button" data-drop-toggle title="字体颜色">${RibbonIcons.color}<span data-swatch="color"></span></button>
                <div class="ho-sheet-palette">${TEXT_COLORS.map((color) => `<button type="button" data-color="${color}" style="background:${color}"></button>`).join("")}</div>
              </div>
              <div class="ho-sheet-drop">
                <button type="button" data-drop-toggle title="填充">${RibbonIcons.fill}<span data-swatch="fill"></span></button>
                <div class="ho-sheet-palette">${FILLS.map((fill) => `<button type="button" data-fill="${fill}" style="background:${fill === "none" ? "#fff" : fill}"></button>`).join("")}</div>
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
          <div class="ho-sheet-group-body">
            <div class="ho-sheet-row">
              ${ribbonButton("insert-image", "插入浮动图片", RibbonIcons.image)}
              ${ribbonButton("delete-image", "删除选中图片", RibbonIcons.imageOff)}
            </div>
            <div class="ho-sheet-row">
              ${ribbonButton("autofilter", "自动筛选", RibbonIcons.filter)}
              ${ribbonButton("freeze", "冻结窗格", RibbonIcons.freeze)}
            </div>
          </div>
          <span>单元格</span>
        </section>
      </div>
      <div class="ho-sheet-ribbon-formula">
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body">
            <div class="ho-sheet-row">
              <button type="button" data-formula="SUM" title="SUM">${RibbonIcons.sigma}<span>求和</span></button>
              <button type="button" data-formula="AVERAGE" title="AVERAGE">${RibbonIcons.average}<span>平均</span></button>
            </div>
            <div class="ho-sheet-row">
              <button type="button" data-formula="MAX" title="MAX">${RibbonIcons.max}<span>最大</span></button>
              <button type="button" data-formula="MIN" title="MIN">${RibbonIcons.min}<span>最小</span></button>
            </div>
          </div>
          <span>常用</span>
        </section>
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body">
            <div class="ho-sheet-row">
              <button type="button" data-formula="IF" title="IF">${RibbonIcons.logic}<span>IF</span></button>
              <button type="button" data-formula="AND" title="AND">${RibbonIcons.logic}<span>AND</span></button>
            </div>
            <div class="ho-sheet-row">
              <button type="button" data-formula="OR" title="OR">${RibbonIcons.logic}<span>OR</span></button>
            </div>
          </div>
          <span>逻辑</span>
        </section>
        <section class="ho-sheet-group">
          <div class="ho-sheet-group-body">
            <div class="ho-sheet-row">
              <button type="button" data-formula="CONCAT" title="CONCAT">${RibbonIcons.concat}<span>连接</span></button>
            </div>
          </div>
          <span>文本</span>
        </section>
      </div>
    `;
  }
}
