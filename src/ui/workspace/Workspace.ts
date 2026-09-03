import { AddImageCommand } from "../../edit/AddImageCommand";
import { ApplyAutoFilterCommand } from "../../edit/ApplyAutoFilterCommand";
import { ApplyBorderCommand } from "../../edit/ApplyBorderCommand";
import { ClearRangeCommand } from "../../edit/ClearRangeCommand";
import { Clipboard } from "../../edit/Clipboard";
import { DeleteColumnCommand } from "../../edit/DeleteColumnCommand";
import { DeleteImageCommand } from "../../edit/DeleteImageCommand";
import { DeleteRowCommand } from "../../edit/DeleteRowCommand";
import type { EditHost } from "../../edit/EditHost";
import type { BorderMode, FormatAction } from "../../edit/FormatAction";
import { History } from "../../edit/History";
import { InsertColumnCommand } from "../../edit/InsertColumnCommand";
import { InsertRowCommand } from "../../edit/InsertRowCommand";
import { MergeCommand } from "../../edit/MergeCommand";
import { PaintFormatCommand } from "../../edit/PaintFormatCommand";
import { PasteCommand } from "../../edit/PasteCommand";
import { ResizeCommand } from "../../edit/ResizeCommand";
import { SetCellStyleCommand } from "../../edit/SetCellStyleCommand";
import { SetCellTextCommand } from "../../edit/SetCellTextCommand";
import { SetFreezeCommand } from "../../edit/SetFreezeCommand";
import { ToggleAutoFilterCommand } from "../../edit/ToggleAutoFilterCommand";
import { UnmergeCommand } from "../../edit/UnmergeCommand";
import { UpdateImageCommand } from "../../edit/UpdateImageCommand";
import { ContextMenu, type MenuAction } from "../contextmenu/ContextMenu";
import { FORMULA_ITEMS, formulaStub, guessNumberRange } from "../../formula/FormulaInsert";
import { FormulaEngine } from "../../formula/FormulaEngine";
import { WorkbookReader } from "../../io/json/WorkbookReader";
import { WorkbookWriter } from "../../io/json/WorkbookWriter";
import { cellDisplay } from "../../model/Cell";
import { CellRange } from "../../model/CellRange";
import { cloneStyle, DEFAULT_STYLE, type CellStyle } from "../../model/CellStyle";
import type { Sheet } from "../../model/Sheet";
import type { WorkbookJson } from "../../model/SheetJson";
import { Workbook } from "../../model/Workbook";
import type { SheetImageOptions } from "../../model/SheetImage";
import { Draw } from "../../render/Draw";
import { cellScreenXY } from "../../render/FreezePane";
import { imageCache } from "../../render/image/ImageCache";
import { SheetPainter } from "../../render/SheetPainter";
import { HitTester } from "../../selection/HitTester";
import { Selection } from "../../selection/Selection";
import {
  DEFAULT_IMAGE_MAX,
  HEADER_HEIGHT,
  INDEX_WIDTH,
  MIN_COL_WIDTH,
  MIN_ROW_HEIGHT,
  SCROLLBAR_SIZE,
} from "../../shared/constants";
import { SheetScrollbar } from "./SheetScrollbar";
import { xy2expr } from "../../shared/alphabet";
import { PrintPreview } from "../../print/PrintPreview";
import { FilterDropdown } from "../filter/FilterDropdown";
import { InputController } from "../input/InputController";
import { PointerController } from "../pointer/PointerController";

export class Workspace implements EditHost {
  workbook = Workbook.blank();
  readonly history = new History();
  readonly selection = new Selection();
  readonly clipboard = new Clipboard();
  readonly engineInst = new FormulaEngine();
  editing = false;
  private readonly root: HTMLElement;
  readonly scroll: HTMLElement;
  private readonly sizer: HTMLElement;
  private readonly vbar: SheetScrollbar;
  private readonly hbar: SheetScrollbar;
  private readonly canvas: HTMLCanvasElement;
  readonly editor: HTMLTextAreaElement;
  readonly capture: HTMLInputElement;
  readonly draw: Draw;
  private readonly painter = new SheetPainter();
  readonly hit = new HitTester();
  private readonly pointer: PointerController;
  private readonly input: InputController;
  private readonly uiListeners: Array<() => void> = [];
  private readonly writer = new WorkbookWriter();
  private readonly reader = new WorkbookReader();
  private readonly menu = new ContextMenu((action) => this.onMenu(action));
  private readonly filterMenu = new FilterDropdown();
  private readonly printUi = new PrintPreview();
  private resizePrev = 0;
  private focusTimer = 0;
  selectedImageId: number | undefined;
  private paintFormat: { sheet: Sheet; range: CellRange; styles: Array<Array<CellStyle | undefined>> } | null = null;
  caption = "未命名工作簿";

  constructor(host: HTMLElement) {
    this.root = host;
    host.classList.add("ho-sheet-workspace");
    host.innerHTML = `
      <div class="ho-sheet-scroll"></div>
      <canvas class="ho-sheet-canvas"></canvas>
      <textarea class="ho-sheet-editor" spellcheck="false" autocomplete="off"></textarea>
      <input class="ho-sheet-capture" spellcheck="false" autocomplete="off" />
    `;
    this.scroll = host.querySelector(".ho-sheet-scroll")!;
    this.sizer = document.createElement("div");
    this.sizer.className = "ho-sheet-sizer";
    this.scroll.append(this.sizer);
    this.canvas = host.querySelector(".ho-sheet-canvas")!;
    this.editor = host.querySelector(".ho-sheet-editor")!;
    this.capture = host.querySelector(".ho-sheet-capture")!;
    this.draw = new Draw(this.canvas);
    this.pointer = new PointerController(this);
    this.input = new InputController(this);
    this.pointer.attach(this.scroll);
    this.input.attach(this.root);
    this.filterMenu.onOk = (ci, order, values) => {
      this.history.do(new ApplyAutoFilterCommand(this, ci, order, values));
    };
    this.vbar = new SheetScrollbar(true, {
      viewSize: () => this.root.clientHeight - SCROLLBAR_SIZE,
      contentSize: () => HEADER_HEIGHT + this.sheet().contentHeight(),
      scrollPos: () => this.scroll.scrollTop,
      setScroll: (pos) => {
        this.scroll.scrollTop = pos;
      },
    });
    this.hbar = new SheetScrollbar(false, {
      viewSize: () => this.root.clientWidth - SCROLLBAR_SIZE,
      contentSize: () => INDEX_WIDTH + this.sheet().contentWidth(),
      scrollPos: () => this.scroll.scrollLeft,
      setScroll: (pos) => {
        this.scroll.scrollLeft = pos;
      },
    });
    const corner = document.createElement("div");
    corner.className = "ho-sheet-bar-corner";
    host.append(this.vbar.el, this.hbar.el, corner);
    this.scroll.addEventListener("scroll", this.onScroll);
    window.addEventListener("resize", this.onResize);
    imageCache.onReady(() => this.render());
    this.newBlank();
  }

  focusGrid(): void {
    this.scheduleCaptureFocus(true);
  }

  focusCapture(): void {
    this.scheduleCaptureFocus(false);
  }

  private scheduleCaptureFocus(force: boolean): void {
    if (this.editing) {
      return;
    }
    if (!force) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest(".ho-sheet-fx-input, .ho-sheet-addr, .ho-sheet-ribbon, .ho-sheet-contextmenu, .ho-sheet-sort-filter")) {
        return;
      }
    }
    this.placeCapture();
    window.clearTimeout(this.focusTimer);
    this.focusTimer = window.setTimeout(() => {
      if (this.editing) {
        return;
      }
      this.capture.focus({ preventScroll: true });
    }, 20);
  }

  sheet(): Sheet {
    return this.workbook.active();
  }

  engine(): FormulaEngine {
    return this.engineInst;
  }

  afterChange(): void {
    this.syncSizer();
    this.render();
    this.emitUi();
    this.focusCapture();
  }

  onUi(listener: () => void): void {
    this.uiListeners.push(listener);
  }

  emitUi(): void {
    for (const listener of this.uiListeners) {
      listener();
    }
  }

  newBlank(): void {
    this.filterMenu.hide();
    this.workbook = Workbook.blank();
    this.history.clear();
    this.selection.set(0, 0);
    this.selectedImageId = undefined;
    this.clipboard.clear();
    this.cancelPaintFormat(false);
    this.caption = "未命名工作簿";
    this.cancelEdit();
    this.scroll.scrollLeft = 0;
    this.scroll.scrollTop = 0;
    this.afterChange();
  }

  loadJson(json: unknown, caption = "未命名工作簿"): void {
    this.replaceWorkbook(this.reader.read(json), caption);
  }

  async loadXlsx(buffer: ArrayBuffer, caption = "未命名工作簿"): Promise<void> {
    const { XlsxReader } = await import("../../io/xlsx/XlsxReader");
    this.replaceWorkbook(await new XlsxReader().read(buffer), caption);
  }

  async loadFile(file: File): Promise<void> {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx")) {
      await this.loadXlsx(await file.arrayBuffer(), file.name);
      return;
    }
    this.loadJson(JSON.parse(await file.text()) as unknown, file.name);
  }

  private replaceWorkbook(book: Workbook, caption: string): void {
    this.workbook = book;
    this.workbook.sheets.forEach((sheet) => this.engineInst.recalculate(sheet));
    this.history.clear();
    this.selection.set(0, 0, this.sheet());
    this.selectedImageId = undefined;
    this.clipboard.clear();
    this.cancelPaintFormat(false);
    this.caption = caption;
    this.cancelEdit();
    this.scroll.scrollLeft = 0;
    this.scroll.scrollTop = 0;
    this.afterChange();
  }

  exportJson(): WorkbookJson {
    return this.writer.write(this.workbook);
  }

  async exportXlsx(): Promise<ArrayBuffer> {
    const { XlsxWriter } = await import("../../io/xlsx/XlsxWriter");
    return new XlsxWriter().write(this.workbook);
  }

  render(): void {
    const width = Math.max(1, this.root.clientWidth - SCROLLBAR_SIZE);
    const height = Math.max(1, this.root.clientHeight - SCROLLBAR_SIZE);
    this.draw.resize(width, height);
    this.painter.paint(
      this.draw,
      this.sheet(),
      this.selection,
      this.scroll.scrollLeft,
      this.scroll.scrollTop,
      this.selectedImageId,
      this.clipboardRange() ?? this.paintFormatRange(),
    );
    this.placeEditor();
    this.placeCapture();
    this.vbar.layout();
    this.hbar.layout();
  }

  scrollX(): number {
    return this.scroll.scrollLeft;
  }

  scrollY(): number {
    return this.scroll.scrollTop;
  }

  setCellText(text: string): void {
    const { ri, ci } = this.selection;
    const current = this.sheet().getCell(ri, ci)?.text ?? "";
    if (current === text) {
      this.afterChange();
      return;
    }
    this.history.do(new SetCellTextCommand(this, ri, ci, text));
  }

  enterEdit(initial?: string): void {
    const cell = this.sheet().getCell(this.selection.ri, this.selection.ci);
    this.editing = true;
    this.capture.value = "";
    this.capture.classList.remove("is-ime");
    this.root.classList.add("is-editing");
    this.editor.value = initial !== undefined ? initial : (cell?.text ?? "");
    this.editor.classList.add("is-on");
    this.placeEditor();
    this.editor.focus();
    if (initial !== undefined) {
      this.editor.setSelectionRange(this.editor.value.length, this.editor.value.length);
    } else {
      this.editor.select();
    }
    this.emitUi();
  }

  commitEdit(move: "down" | "up" | "right" | "left" | "none" = "none"): void {
    if (!this.editing) {
      return;
    }
    const text = this.editor.value;
    this.editing = false;
    this.editor.classList.remove("is-on");
    this.root.classList.remove("is-editing");
    this.setCellText(text);
    if (move === "down") {
      this.selection.move(1, 0, this.sheet());
    } else if (move === "up") {
      this.selection.move(-1, 0, this.sheet());
    } else if (move === "right") {
      this.selection.move(0, 1, this.sheet());
    } else if (move === "left") {
      this.selection.move(0, -1, this.sheet());
    }
    this.ensureVisible();
    this.render();
    this.emitUi();
    this.focusCapture();
  }

  cancelEdit(): void {
    this.editing = false;
    this.editor.classList.remove("is-on");
    this.root.classList.remove("is-editing");
    this.editor.value = "";
    this.placeEditor();
    this.emitUi();
    this.focusCapture();
  }

  applyFormat(action: FormatAction): void {
    const range = this.selection.range;
    if (action.type === "clear") {
      this.history.do(new SetCellStyleCommand(this, range, "clear"));
      return;
    }
    const current = this.sheet().getCellStyle(this.selection.ri, this.selection.ci);
    const patch = formatToPatch(action, current);
    this.history.do(new SetCellStyleCommand(this, range, patch));
  }

  applyBorder(mode: BorderMode, color = "#000000"): void {
    this.history.do(new ApplyBorderCommand(this, this.selection.range.clone(), mode, color));
  }

  mergeSelection(): void {
    const range = this.selection.range;
    if (!range.multiple()) {
      return;
    }
    this.history.do(new MergeCommand(this, range));
  }

  toggleAutoFilter(): void {
    this.filterMenu.hide();
    this.history.do(new ToggleAutoFilterCommand(this, this.selection.range.clone()));
  }

  printPreview(): void {
    this.commitEdit("none");
    if (this.printUi.isOpen()) {
      this.printUi.print();
      return;
    }
    this.printUi.open(this.sheet());
  }

  insertFunction(name: string): void {
    const item = FORMULA_ITEMS.find((entry) => entry.name === name);
    if (!item) {
      return;
    }
    this.commitEdit("none");
    const sheet = this.sheet();
    const range = this.selection.range;
    if (item.range && range.multiple()) {
      const ri = Math.min(range.eri + 1, sheet.rows.len - 1);
      const ci = range.sci;
      this.selection.set(ri, ci, sheet);
      this.history.do(new SetCellTextCommand(this, ri, ci, formulaStub(name, range.toString())));
      this.ensureVisible();
      return;
    }
    if (item.range) {
      const guessed = guessNumberRange(sheet, this.selection.ri, this.selection.ci);
      if (guessed) {
        this.history.do(new SetCellTextCommand(this, this.selection.ri, this.selection.ci, formulaStub(name, guessed)));
        return;
      }
    }
    const text = formulaStub(name);
    this.enterEdit(text);
    const cursor = text.indexOf("(") + 1;
    this.editor.setSelectionRange(cursor, cursor);
  }

  toggleFreeze(): void {
    const sheet = this.sheet();
    if (sheet.freezeIsActive()) {
      this.history.do(new SetFreezeCommand(this, 0, 0));
      return;
    }
    this.history.do(new SetFreezeCommand(this, this.selection.ri, this.selection.ci));
  }

  openFilterMenu(ci: number): void {
    const sheet = this.sheet();
    if (!sheet.autoFilter.active()) {
      return;
    }
    const items = sheet.autoFilter.items(ci, (ri, col) => cellDisplay(sheet.getCell(ri, col)));
    const filter = sheet.autoFilter.getFilter(ci);
    const sort = sheet.autoFilter.getSort(ci);
    this.filterMenu.set(ci, items, filter?.value, sort?.order);
    const box = sheet.cellBox(sheet.autoFilter.hrange().sri, ci);
    const screen = cellScreenXY(sheet, box.x, box.y, this.scroll.scrollLeft, this.scroll.scrollTop);
    const rect = this.root.getBoundingClientRect();
    this.filterMenu.show(
      rect.left + screen.x,
      rect.top + screen.y + box.height + 2,
    );
  }

  unmergeSelection(): void {
    this.history.do(new UnmergeCommand(this, this.selection.range));
  }

  insertRow(): void {
    this.history.do(new InsertRowCommand(this, this.selection.range.sri, this.selection.range.rowCount()));
  }

  insertColumn(): void {
    this.history.do(new InsertColumnCommand(this, this.selection.range.sci, this.selection.range.colCount()));
  }

  deleteRow(): void {
    this.history.do(new DeleteRowCommand(this, this.selection.range.sri, this.selection.range.rowCount()));
    this.selection.set(Math.min(this.selection.ri, this.sheet().rows.len - 1), this.selection.ci, this.sheet());
    this.afterChange();
  }

  deleteColumn(): void {
    this.history.do(new DeleteColumnCommand(this, this.selection.range.sci, this.selection.range.colCount()));
    this.selection.set(this.selection.ri, Math.min(this.selection.ci, this.sheet().cols.len - 1), this.sheet());
    this.afterChange();
  }

  beginResize(type: "row" | "column", index: number): void {
    this.resizePrev = type === "row" ? this.sheet().rows.getHeight(index) : this.sheet().cols.getWidth(index);
  }

  syncPreview(): void {
    this.syncSizer();
    this.render();
  }

  finishResize(type: "row" | "column", index: number): void {
    const next = type === "row" ? this.sheet().rows.getHeight(index) : this.sheet().cols.getWidth(index);
    const prev = this.resizePrev;
    if (next === prev) {
      this.afterChange();
      return;
    }
    if (type === "row") {
      this.sheet().rows.setHeight(index, prev);
    } else {
      this.sheet().cols.setWidth(index, prev);
    }
    this.history.do(new ResizeCommand(this, type, index, Math.max(type === "row" ? MIN_ROW_HEIGHT : MIN_COL_WIDTH, next), prev));
  }

  showContextMenu(x: number, y: number): void {
    this.menu.show(x, y);
  }

  selectImage(id: number | undefined): void {
    this.selectedImageId = id;
  }

  pickImage(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        void this.insertImageFromFile(file);
      }
    });
    input.click();
  }

  async insertImageFromFile(file: File): Promise<void> {
    const url = await readFileDataUrl(file);
    const size = await measureImage(url);
    imageCache.prime(url, size.image);
    const max = DEFAULT_IMAGE_MAX;
    const scale = Math.min(1, max / Math.max(size.width, size.height, 1));
    const width = Math.max(1, size.width * scale);
    const height = Math.max(1, size.height * scale);
    const box = this.sheet().cellBox(this.selection.ri, this.selection.ci);
    const image = {
      id: this.sheet().images.nextId(),
      url,
      options: {
        left: INDEX_WIDTH + box.x + width / 2,
        top: HEADER_HEIGHT + box.y + height / 2,
        width: size.width,
        height: size.height,
        scaleX: scale,
        scaleY: scale,
      },
    };
    this.history.do(new AddImageCommand(this, image));
    this.selectedImageId = image.id;
    this.render();
    this.emitUi();
  }

  deleteSelectedImage(): void {
    if (this.selectedImageId === undefined) {
      return;
    }
    const image = this.sheet().images.get(this.selectedImageId);
    if (!image) {
      return;
    }
    this.history.do(new DeleteImageCommand(this, image));
    this.selectedImageId = undefined;
    this.render();
    this.emitUi();
  }

  nudgeImage(dri: number, dci: number, step: number): void {
    if (this.selectedImageId === undefined) {
      return;
    }
    const image = this.sheet().images.get(this.selectedImageId);
    if (!image) {
      return;
    }
    const prev = { ...image.options };
    const next = {
      ...prev,
      left: prev.left + dci * step,
      top: prev.top + dri * step,
    };
    this.sheet().images.setOptions(this.selectedImageId, prev);
    this.history.do(new UpdateImageCommand(this, this.selectedImageId, next, prev));
  }

  pageRowCount(): number {
    const fsh = this.sheet().freezeTotalHeight();
    const viewH = Math.max(1, this.scroll.clientHeight - HEADER_HEIGHT);
    const start = this.sheet().findRowAt(this.scrollY() + fsh);
    const end = this.sheet().findRowAt(this.scrollY() + viewH);
    if (!start) {
      return 10;
    }
    return Math.max(1, (end?.ri ?? this.sheet().rows.len - 1) - start.ri);
  }

  finishImageDrag(id: number, prev: SheetImageOptions): void {
    const image = this.sheet().images.get(id);
    if (!image) {
      return;
    }
    const next = image.options;
    if (next.left === prev.left && next.top === prev.top && next.scaleX === prev.scaleX && next.scaleY === prev.scaleY) {
      this.render();
      return;
    }
    this.sheet().images.setOptions(id, prev);
    this.history.do(new UpdateImageCommand(this, id, next, prev));
  }

  clearSelection(): void {
    this.history.do(new ClearRangeCommand(this, this.selection.range.clone()));
  }

  copy(mode: "copy" | "cut" = "copy"): string {
    const payload = this.clipboard.copy(this.sheet(), this.selection.range, mode);
    this.render();
    return this.clipboard.toTsv(payload);
  }

  clipboardRange(): CellRange | undefined {
    const payload = this.clipboard.payload;
    if (!payload || payload.sheet !== this.sheet()) {
      return undefined;
    }
    return payload.range;
  }

  clearClipboard(): void {
    const hadClip = !!this.clipboard.payload;
    const hadPaint = !!this.paintFormat;
    this.clipboard.clear();
    this.cancelPaintFormat(false);
    if (hadClip || hadPaint) {
      this.render();
      this.emitUi();
    }
  }

  paintFormatRange(): CellRange | undefined {
    if (!this.paintFormat || this.paintFormat.sheet !== this.sheet()) {
      return undefined;
    }
    return this.paintFormat.range;
  }

  togglePaintFormat(): void {
    if (this.paintFormat) {
      this.cancelPaintFormat();
      return;
    }
    this.commitEdit("none");
    const sheet = this.sheet();
    const range = this.selection.range.clone();
    const styles: Array<Array<CellStyle | undefined>> = [];
    for (let ri = range.sri; ri <= range.eri; ri += 1) {
      const row: Array<CellStyle | undefined> = [];
      for (let ci = range.sci; ci <= range.eci; ci += 1) {
        row.push(sheet.getCell(ri, ci)?.style === undefined ? undefined : cloneStyle(sheet.rawStyle(ri, ci)));
      }
      styles.push(row);
    }
    this.paintFormat = { sheet, range, styles };
    this.root.classList.add("is-paintformat");
    this.render();
    this.emitUi();
  }

  applyPaintFormat(): void {
    const paint = this.paintFormat;
    if (!paint || paint.sheet !== this.sheet()) {
      return;
    }
    const dest = this.selection.range;
    if (dest.sri === paint.range.sri && dest.sci === paint.range.sci && dest.eri === paint.range.eri && dest.eci === paint.range.eci) {
      return;
    }
    this.history.do(new PaintFormatCommand(this, dest.clone(), paint.styles));
    this.cancelPaintFormat();
  }

  private cancelPaintFormat(refresh = true): void {
    if (!this.paintFormat) {
      return;
    }
    this.paintFormat = null;
    this.root.classList.remove("is-paintformat");
    if (refresh) {
      this.render();
      this.emitUi();
    }
  }

  cut(): string {
    const text = this.copy("cut");
    this.history.do(new ClearRangeCommand(this, this.selection.range.clone()));
    return text;
  }

  pasteCells(grid: Array<Array<import("../../model/Cell").Cell | undefined>>): void {
    if (grid.length === 0) {
      return;
    }
    const ri = this.selection.ri;
    const ci = this.selection.ci;
    const rows = grid.length;
    const cols = Math.max(...grid.map((row) => row.length));
    const range = new CellRange(ri, ci, ri + rows - 1, ci + cols - 1);
    this.history.do(new PasteCommand(this, ri, ci, grid, range));
    this.selection.setRange(ri, ci, range.eri, range.eci, this.sheet());
  }

  pasteTsv(text: string): void {
    this.pasteCells(this.clipboard.fromTsv(text));
  }

  pasteInternal(): void {
    const payload = this.clipboard.payload;
    if (!payload) {
      return;
    }
    this.pasteCells(payload.cells);
    if (payload.mode === "cut") {
      this.clipboard.clear();
    }
  }

  addSheet(): void {
    this.workbook.addSheet();
    this.selection.set(0, 0);
    this.cancelEdit();
    this.afterChange();
  }

  switchSheet(index: number): void {
    this.commitEdit("none");
    this.workbook.setActive(index);
    this.selection.set(0, 0, this.sheet());
    this.selectedImageId = undefined;
    this.cancelPaintFormat(false);
    this.afterChange();
  }

  renameSheet(index: number, name: string): void {
    this.workbook.renameSheet(index, name);
    this.afterChange();
  }

  deleteActiveSheet(): void {
    this.workbook.deleteSheet(this.workbook.activeIndex);
    this.selection.set(0, 0, this.sheet());
    this.afterChange();
  }

  formatState(): FormatState {
    const style = this.sheet().getCellStyle(this.selection.ri, this.selection.ci);
    const cell = this.sheet().getCell(this.selection.ri, this.selection.ci);
    return {
      caption: this.caption,
      address: xy2expr(this.selection.ci, this.selection.ri),
      formula: this.editing ? this.editor.value : (cell?.text ?? ""),
      display: cellDisplay(cell),
      fontFamily: style.font?.name ?? DEFAULT_STYLE.font.name ?? "Arial",
      fontSizePt: style.font?.size ?? 10,
      bold: !!style.font?.bold,
      italic: !!style.font?.italic,
      underline: !!style.underline,
      strike: !!style.strike,
      color: style.color ?? DEFAULT_STYLE.color,
      bgcolor: style.bgcolor ?? DEFAULT_STYLE.bgcolor,
      align: style.align ?? "left",
      valign: style.valign ?? "middle",
      textwrap: !!style.textwrap,
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
      merged: !!this.sheet().merges.getFirstIncludes(this.selection.ri, this.selection.ci),
      sheetNames: this.workbook.sheets.map((item) => item.name),
      activeSheet: this.workbook.activeIndex,
      autoFilter: this.sheet().autoFilter.active(),
      freeze: this.sheet().freezeIsActive(),
      paintFormat: !!this.paintFormat,
    };
  }

  ensureVisible(): void {
    const sheet = this.sheet();
    const box = sheet.cellBox(this.selection.focusRi, this.selection.focusCi);
    const fsw = sheet.freezeTotalWidth();
    const fsh = sheet.freezeTotalHeight();
    const viewW = this.scroll.clientWidth - INDEX_WIDTH;
    const viewH = this.scroll.clientHeight - HEADER_HEIGHT;
    let x = this.scroll.scrollLeft;
    let y = this.scroll.scrollTop;
    if (box.x >= fsw) {
      if (box.x - x < fsw) {
        x = box.x - fsw;
      } else if (box.x + box.width - x > viewW) {
        x = box.x + box.width - viewW;
      }
    }
    if (box.y >= fsh) {
      if (box.y - y < fsh) {
        y = box.y - fsh;
      } else if (box.y + box.height - y > viewH) {
        y = box.y + box.height - viewH;
      }
    }
    this.scroll.scrollLeft = Math.max(0, x);
    this.scroll.scrollTop = Math.max(0, y);
  }

  cellScreenRect(): { x: number; y: number; width: number; height: number } {
    const sheet = this.sheet();
    const box = sheet.cellBox(this.selection.ri, this.selection.ci);
    const screen = cellScreenXY(sheet, box.x, box.y, this.scroll.scrollLeft, this.scroll.scrollTop);
    return {
      x: screen.x,
      y: screen.y,
      width: box.width,
      height: box.height,
    };
  }

  placeCapture(): void {
    const rect = this.cellScreenRect();
    this.capture.style.left = `${rect.x}px`;
    this.capture.style.top = `${rect.y}px`;
    if (this.capture.classList.contains("is-ime")) {
      this.capture.style.width = `${Math.max(rect.width, 40)}px`;
      this.capture.style.height = `${Math.max(rect.height, 20)}px`;
    } else {
      this.capture.style.width = "0px";
      this.capture.style.height = "0px";
    }
  }

  private placeEditor(): void {
    const rect = this.cellScreenRect();
    this.editor.style.left = `${rect.x}px`;
    this.editor.style.top = `${rect.y}px`;
    this.editor.style.width = `${Math.max(rect.width, 40)}px`;
    this.editor.style.height = `${Math.max(rect.height, 20)}px`;
  }

  private syncSizer(): void {
    const sheet = this.sheet();
    this.sizer.style.width = `${INDEX_WIDTH + sheet.contentWidth()}px`;
    this.sizer.style.height = `${HEADER_HEIGHT + sheet.contentHeight()}px`;
  }

  private onScroll = (): void => {
    this.filterMenu.hide();
    if (this.editing) {
      this.placeEditor();
    }
    this.render();
  };

  private onResize = (): void => {
    this.render();
  };

  private onMenu(action: MenuAction): void {
    if (action === "copy") {
      void navigator.clipboard.writeText(this.copy());
    } else if (action === "cut") {
      void navigator.clipboard.writeText(this.cut());
    } else if (action === "paste") {
      this.pasteInternal();
    } else if (action === "clear") {
      this.clearSelection();
    } else if (action === "insert-row") {
      this.insertRow();
    } else if (action === "insert-col") {
      this.insertColumn();
    } else if (action === "delete-row") {
      this.deleteRow();
    } else if (action === "delete-col") {
      this.deleteColumn();
    } else if (action === "merge") {
      this.mergeSelection();
    } else if (action === "unmerge") {
      this.unmergeSelection();
    } else if (action === "insert-image") {
      this.pickImage();
    } else if (action === "delete-image") {
      this.deleteSelectedImage();
    } else if (action === "autofilter") {
      this.toggleAutoFilter();
    } else if (action === "freeze") {
      this.toggleFreeze();
    }
  }
}

export interface FormatState {
  caption: string;
  address: string;
  formula: string;
  display: string;
  fontFamily: string;
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string;
  bgcolor: string;
  align: string;
  valign: string;
  textwrap: boolean;
  canUndo: boolean;
  canRedo: boolean;
  merged: boolean;
      sheetNames: string[];
  activeSheet: number;
  autoFilter: boolean;
  freeze: boolean;
  paintFormat: boolean;
}

function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function measureImage(url: string): Promise<{ width: number; height: number; image: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 200, height: image.naturalHeight || 200, image });
    image.onerror = () => reject(new Error("图片无法加载"));
    image.src = url;
  });
}

function formatToPatch(action: FormatAction, current: CellStyle): CellStyle {
  if (action.type === "bold") {
    return { font: { bold: !current.font?.bold } };
  }
  if (action.type === "italic") {
    return { font: { italic: !current.font?.italic } };
  }
  if (action.type === "underline") {
    return { underline: !current.underline };
  }
  if (action.type === "strike") {
    return { strike: !current.strike };
  }
  if (action.type === "textwrap") {
    return { textwrap: !current.textwrap };
  }
  if (action.type === "align") {
    return { align: action.value };
  }
  if (action.type === "valign") {
    return { valign: action.value };
  }
  if (action.type === "color") {
    return { color: action.value };
  }
  if (action.type === "bgcolor") {
    return { bgcolor: action.value === "none" ? "#ffffff" : action.value };
  }
  if (action.type === "fontFamily") {
    return { font: { name: action.value } };
  }
  if (action.type === "fontSizePt") {
    return { font: { size: action.value } };
  }
  return {};
}

