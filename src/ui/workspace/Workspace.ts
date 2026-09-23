import { AddImageCommand } from "../../edit/AddImageCommand";
import { ApplyAutoFilterCommand } from "../../edit/ApplyAutoFilterCommand";
import { ApplyBorderCommand } from "../../edit/ApplyBorderCommand";
import { ApplyCellPatchesCommand } from "../../edit/ApplyCellPatchesCommand";
import { ClearRangeCommand } from "../../edit/ClearRangeCommand";
import { Clipboard } from "../../edit/Clipboard";
import { DeleteColumnCommand } from "../../edit/DeleteColumnCommand";
import { DeleteImageCommand } from "../../edit/DeleteImageCommand";
import { DeleteRowCommand } from "../../edit/DeleteRowCommand";
import type { EditHost } from "../../edit/EditHost";
import type { BorderMode, FormatAction } from "../../edit/FormatAction";
import { FillCommand } from "../../edit/FillCommand";
import { History } from "../../edit/History";
import { InsertColumnCommand } from "../../edit/InsertColumnCommand";
import { InsertRowCommand } from "../../edit/InsertRowCommand";
import { MergeCommand } from "../../edit/MergeCommand";
import { PaintFormatCommand } from "../../edit/PaintFormatCommand";
import { PasteCommand } from "../../edit/PasteCommand";
import { ResizeCommand } from "../../edit/ResizeCommand";
import { SetCellMarksCommand } from "../../edit/SetCellMarksCommand";
import { SetCellNoteCommand } from "../../edit/SetCellNoteCommand";
import { SetCellStyleCommand } from "../../edit/SetCellStyleCommand";
import { SetCellTextCommand } from "../../edit/SetCellTextCommand";
import { SetFreezeCommand } from "../../edit/SetFreezeCommand";
import { ToggleAutoFilterCommand } from "../../edit/ToggleAutoFilterCommand";
import { UnmergeCommand } from "../../edit/UnmergeCommand";
import { UpdateImageCommand } from "../../edit/UpdateImageCommand";
import { ContextMenu, type MenuAction } from "../contextmenu/ContextMenu";
import {
  applyPointRef,
  isFormulaText,
  nudgeFormulaRange,
  rewriteFormulaRef,
  type FormulaEditState,
} from "../../formula/formulaEdit";
import { scanFormulaRefs, type FormulaRef } from "../../formula/formulaRefs";
import { FORMULA_ITEMS, formulaStub, guessNumberRange } from "../../formula/FormulaInsert";
import { FormulaEngine } from "../../formula/FormulaEngine";
import { WorkbookReader } from "../../io/json/WorkbookReader";
import { WorkbookWriter } from "../../io/json/WorkbookWriter";
import { cellDisplay, cellEditText, cellNoteText } from "../../model/Cell";
import {
  hitDropdownControl,
  hitSwitchControl,
  isSwitchOn,
  switchCellText,
  type CellControl,
} from "../../model/CellControl";
import { CellRange } from "../../model/CellRange";
import { cloneStyle, DEFAULT_STYLE, styleFontCss, type CellStyle } from "../../model/CellStyle";
import { bumpDecimalPlaces, isNumericDisplayFormat } from "../../model/NumberFormat";
import { hasExplicitBreak, wrapLines } from "../../render/textLayout";
import { CellBadges, type ReconcileBadge } from "../../model/CellBadges";
import {
  cellMarkBadgeReserve,
  cloneMark,
  isEmptyMark,
  marksEqual,
  parsePriorityMark,
  parseShapeMark,
  parseVerdictMark,
  type CellMark,
  type CellPriorityMark,
  type CellShapeMark,
  type CellVerdictMark,
  type MarkedCellRange,
} from "../../model/CellMarks";
import type { Sheet } from "../../model/Sheet";
import type { WorkbookJson } from "../../model/SheetJson";
import { Workbook } from "../../model/Workbook";
import type { SheetImageOptions } from "../../model/SheetImage";
import type { FillAxis } from "../../selection/FillHandle";
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
import { expr2xy, xy2expr } from "../../shared/alphabet";
import { CELL_MARKS_SHEET } from "../../io/xlsx/cellMarks";
import { CHECKMARKS_SHEET } from "../../io/xlsx/checkmarks";
import { PrintPreview } from "../../print/PrintPreview";
import { FindDialog } from "../find/FindDialog";
import { CellSelectDropdown } from "../control/CellSelectDropdown";
import { FilterDropdown } from "../filter/FilterDropdown";
import { NoteEditor } from "../note/NoteEditor";
import { NoteTip } from "../note/NoteTip";
import { InputController } from "../input/InputController";
import { PointerController } from "../pointer/PointerController";
import { editorBoxSize } from "./editorBox";

const editorMeasure = document.createElement("canvas").getContext("2d")!;

export class Workspace implements EditHost {
  workbook = Workbook.blank();
  readonly history = new History();
  readonly selection = new Selection();
  readonly cellBadges = new CellBadges();
  readonly clipboard = new Clipboard();
  readonly engineInst = new FormulaEngine();
  editing = false;
  formulaBarCommit: (() => void) | null = null;
  formulaBarApply: ((text: string, cursor: number) => void) | null = null;
  formulaSession: FormulaEditState | null = null;
  readonly root: HTMLElement;
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
  private readonly changeListeners: Array<() => void> = [];
  private readonly writer = new WorkbookWriter();
  private readonly reader = new WorkbookReader();
  private readonly menu: ContextMenu;
  readonly templateMode: boolean;
  private readonly filterMenu = new FilterDropdown();
  private readonly cellSelect = new CellSelectDropdown();
  private readonly noteEditor = new NoteEditor();
  private readonly noteTip = new NoteTip();
  private readonly printUi = new PrintPreview();
  private readonly findUi = new FindDialog(this);
  onRequestDropdownOptions: ((current: string[], apply: (options: string[]) => void) => void) | null = null;
  private resizePrev = 0;
  private focusTimer = 0;
  private readonly resizeObserver: ResizeObserver;
  selectedImageId: number | undefined;
  private paintFormat: { sheet: Sheet; range: CellRange; styles: Array<Array<CellStyle | undefined>> } | null = null;
  caption = "未命名工作簿";
  captionMeta: Array<{ label: string; value: string }> = [];
  onHistoryPersist?: () => void;
  fillPreview?: CellRange;

  constructor(host: HTMLElement, options?: { templateMode?: boolean }) {
    this.templateMode = options?.templateMode === true;
    this.menu = new ContextMenu((action, value) => this.onMenu(action, value), { templateMode: this.templateMode });
    this.root = host;
    host.classList.add("ho-sheet-workspace");
    host.innerHTML = `
      <div class="ho-sheet-scroll"></div>
      <canvas class="ho-sheet-canvas"></canvas>
      <textarea class="ho-sheet-editor" spellcheck="false" autocomplete="off" wrap="off"></textarea>
      <input class="ho-sheet-capture" spellcheck="false" autocomplete="off" />
    `;
    this.scroll = host.querySelector(".ho-sheet-scroll")!;
    this.sizer = document.createElement("div");
    this.sizer.className = "ho-sheet-sizer";
    this.scroll.append(this.sizer);
    this.canvas = host.querySelector(".ho-sheet-canvas")!;
    this.editor = host.querySelector(".ho-sheet-editor")!;
    this.capture = host.querySelector(".ho-sheet-capture")!;
    this.editor.addEventListener("input", () => {
      if (this.editing) {
        this.placeEditor();
        this.updateFormulaEdit(this.editor.value, this.editor.selectionStart);
      }
    });
    this.draw = new Draw(this.canvas);
    this.pointer = new PointerController(this);
    this.input = new InputController(this);
    this.pointer.attach(this.scroll);
    this.input.attach(this.root);
    this.filterMenu.onOk = (ci, order, values) => {
      this.history.do(new ApplyAutoFilterCommand(this, ci, order, values));
    };
    this.cellSelect.onPick = (value) => {
      this.setCellText(value);
    };
    this.noteEditor.onSave = (ri, ci, text) => this.setCellNote(ri, ci, text);
    this.noteEditor.onDelete = (ri, ci) => this.setCellNote(ri, ci, "");
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
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(this.root);
    imageCache.onReady(() => this.render());
    this.history.onPersist = () => this.onHistoryPersist?.();
    this.history.onStackChange = () => this.emitUi();
    this.newBlank();
  }

  commitFormulaBar(): void {
    if (this.formulaSession) {
      return;
    }
    this.formulaBarCommit?.();
  }

  isFormulaEditing(): boolean {
    return !!this.formulaSession;
  }

  formulaPaintRefs(): FormulaRef[] {
    const session = this.formulaSession;
    if (!session || !isFormulaText(session.text)) {
      return [];
    }
    return scanFormulaRefs(session.text, this.sheet().name);
  }

  beginFormulaEdit(source: FormulaEditState["source"], text: string, cursor: number, mode: FormulaEditState["mode"]): void {
    if (this.formulaSession && this.formulaSession.source === source) {
      this.formulaSession = { ...this.formulaSession, text, cursor };
      this.render();
      return;
    }
    this.clipboard.clear();
    this.formulaSession = {
      source,
      mode,
      anchorRi: this.selection.ri,
      anchorCi: this.selection.ci,
      text,
      cursor,
      activeStart: undefined,
    };
    this.render();
    this.emitUi();
  }

  updateFormulaEdit(text: string, cursor: number): void {
    if (!this.formulaSession) {
      if (isFormulaText(text)) {
        this.beginFormulaEdit(this.editing ? "cell" : "bar", text, cursor, this.editing ? "point" : "edit");
      }
      return;
    }
    const refs = scanFormulaRefs(text, this.sheet().name);
    const inside = refs.find((ref) => cursor >= ref.start && cursor <= ref.end);
    this.formulaSession = {
      ...this.formulaSession,
      text,
      cursor,
      activeStart: inside?.start,
    };
    if (!isFormulaText(text)) {
      this.formulaSession = null;
    }
    this.render();
  }

  toggleFormulaMode(): void {
    if (!this.formulaSession) {
      return;
    }
    this.formulaSession = {
      ...this.formulaSession,
      mode: this.formulaSession.mode === "point" ? "edit" : "point",
    };
  }

  applyFormulaPoint(sri: number, sci: number, eri: number, eci: number): void {
    if (!this.formulaSession) {
      return;
    }
    this.formulaSession = applyPointRef(this.formulaSession, new CellRange(sri, sci, eri, eci), this.sheet().name);
    this.writeFormulaSession();
    this.render();
    this.emitUi();
  }

  nudgeFormulaPoint(dri: number, dci: number, extend: boolean): boolean {
    const session = this.formulaSession;
    if (!session || session.mode !== "point") {
      return false;
    }
    const refs = scanFormulaRefs(session.text, this.sheet().name);
    const current = refs.find((ref) => session.activeStart === ref.start) ?? refs.find((ref) => session.cursor >= ref.start && session.cursor <= ref.end);
    const base = current?.range ?? CellRange.cell(session.anchorRi, session.anchorCi);
    this.formulaSession = applyPointRef(session, nudgeFormulaRange(base, dri, dci, extend), this.sheet().name);
    this.writeFormulaSession();
    this.render();
    this.emitUi();
    return true;
  }

  rewriteFormulaSpan(index: number, range: CellRange): void {
    const session = this.formulaSession;
    if (!session) {
      return;
    }
    const refs = scanFormulaRefs(session.text, this.sheet().name);
    const ref = refs[index];
    if (!ref) {
      return;
    }
    const next = rewriteFormulaRef(session.text, ref, range);
    this.formulaSession = { ...session, text: next.text, cursor: next.cursor, activeStart: ref.start, mode: "point" };
    this.writeFormulaSession();
    this.render();
    this.emitUi();
  }

  endFormulaEdit(): void {
    this.formulaSession = null;
    this.render();
  }

  private writeFormulaSession(): void {
    const session = this.formulaSession;
    if (!session) {
      return;
    }
    if (session.source === "bar" || !this.editing) {
      this.formulaBarApply?.(session.text, session.cursor);
    }
    if (this.editing) {
      this.editor.value = session.text;
      this.editor.setSelectionRange(session.cursor, session.cursor);
      this.placeEditor();
    }
  }

  focusGrid(): void {
    this.scheduleCaptureFocus(true);
  }

  focusCapture(): void {
    this.scheduleCaptureFocus(false);
  }

  cancelCaptureFocus(): void {
    window.clearTimeout(this.focusTimer);
  }

  private isChromeFocused(): boolean {
    const active = document.activeElement;
    return (
      active instanceof HTMLElement
      && !!active.closest(".ho-sheet-formulabar, .ho-sheet-fx-input, .ho-sheet-addr, .ho-sheet-ribbon, .ho-sheet-tabs, .ho-sheet-statusbar, .ho-sheet-contextmenu, .ho-sheet-sort-filter, .ho-sheet-note-editor, .ho-sheet-find, .ho-sheet-print, .ant-modal")
    );
  }

  private scheduleCaptureFocus(force: boolean): void {
    if (this.editing) {
      return;
    }
    if (!force && this.isChromeFocused()) {
      return;
    }
    this.placeCapture();
    window.clearTimeout(this.focusTimer);
    this.focusTimer = window.setTimeout(() => {
      if (this.editing || this.isChromeFocused()) {
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

  setCaptionMeta(items: Array<{ label: string; value: string }>): void {
    this.captionMeta = items;
    this.emitUi();
  }

  afterChange(): void {
    this.syncSizer();
    this.render();
    this.emitUi();
    this.emitChange();
    this.focusCapture();
  }

  onUi(listener: () => void): void {
    this.uiListeners.push(listener);
  }

  onChange(listener: () => void): void {
    this.changeListeners.push(listener);
  }

  emitUi(): void {
    this.menu.setEditControl(this.editControlEnabled());
    for (const listener of this.uiListeners) {
      listener();
    }
  }

  emitChange(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }

  destroy(): void {
    this.filterMenu.hide();
    this.findUi.destroy();
    this.input.detach();
    this.cellSelect.destroy();
    this.noteEditor.destroy();
    this.noteTip.destroy();
    this.menu.hide();
    this.scroll.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onResize);
    this.resizeObserver.disconnect();
    window.clearTimeout(this.focusTimer);
    this.uiListeners.length = 0;
    this.changeListeners.length = 0;
    this.root.replaceChildren();
  }

  isFillLocked(): boolean {
    return this.workbook.enforceEditLock && !this.templateMode;
  }

  editControlEnabled(): boolean {
    return this.templateMode && this.workbook.keepEditables;
  }

  setEditControlEnabled(on: boolean): void {
    if (!this.templateMode || this.workbook.keepEditables === on) {
      return;
    }
    this.workbook.keepEditables = on;
    this.afterChange();
  }

  canEditCell(ri = this.selection.ri, ci = this.selection.ci): boolean {
    return !this.isFillLocked() || this.sheet().hasEditable(ri, ci);
  }

  canEditRange(range = this.selection.range): boolean {
    if (!this.isFillLocked()) {
      return true;
    }
    const sheet = this.sheet();
    for (let ri = range.sri; ri <= range.eri; ri += 1) {
      for (let ci = range.sci; ci <= range.eci; ci += 1) {
        if (!sheet.hasEditable(ri, ci)) {
          return false;
        }
      }
    }
    return true;
  }

  canEditSelection(): boolean {
    return this.selection.ranges().every((range) => this.canEditRange(range));
  }

  canMutateStructure(): boolean {
    return !this.isFillLocked();
  }

  private rejectLocked(kind: "cell" | "range" | "structure" = "cell"): boolean {
    const allowed = kind === "structure"
      ? this.canMutateStructure()
      : kind === "range"
        ? this.canEditSelection()
        : this.canEditCell();
    if (allowed) {
      return false;
    }
    this.onLockedEdit?.();
    return true;
  }

  newBlank(): void {
    this.filterMenu.hide();
    this.cellSelect.hide();
    this.noteEditor.hide();
    this.noteTip.hide();
    this.workbook = Workbook.blank();
    this.engineInst.attach(this.workbook);
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

  async applyTemplate(buffer: ArrayBuffer): Promise<{
    appliedSheets: number;
    markCount: number;
    enabled: boolean;
    clearedLock: boolean;
  }> {
    const { XlsxReader } = await import("../../io/xlsx/XlsxReader");
    const { applyTemplateToWorkbook } = await import("../../io/xlsx/templateLock");
    const template = await new XlsxReader().read(buffer);
    const result = applyTemplateToWorkbook(this.workbook, template);
    this.replaceWorkbook(this.workbook, this.caption);
    return result;
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
    if (this.templateMode) {
      book.enforceEditLock = false;
    }
    this.engineInst.attach(book);
    this.engineInst.recalculate(book.active());
    this.history.clear();
    this.selection.set(0, 0, this.sheet());
    this.selectedImageId = undefined;
    this.clipboard.clear();
    this.cancelPaintFormat(false);
    this.cellSelect.hide();
    this.noteEditor.hide();
    this.noteTip.hide();
    this.caption = caption;
    this.cellBadges.clearAll();
    this.cancelEdit();
    this.scroll.scrollLeft = 0;
    this.scroll.scrollTop = 0;
    this.afterChange();
  }

  exportJson(): WorkbookJson {
    return this.writer.write(this.workbook);
  }

  async exportXlsx(persistedCheckmarksOnly = false): Promise<ArrayBuffer> {
    const { XlsxWriter } = await import("../../io/xlsx/XlsxWriter");
    return new XlsxWriter().write(this.workbook, persistedCheckmarksOnly);
  }

  commitCheckmarks(): void {
    for (const sheet of this.workbook.sheets) {
      sheet.commitSessionCheckmarks();
    }
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
      this.formulaPaintRefs(),
      this.fillPreview,
      !this.editing && !this.isFormulaEditing() && this.selectedImageId === undefined,
      this.editControlEnabled() || this.workbook.enforceEditLock,
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
    if (this.rejectLocked()) {
      return;
    }
    const { ri, ci } = this.selection;
    const cell = this.sheet().getCell(ri, ci);
    const current = cell?.text ?? "";
    const fmt = this.sheet().getCellStyle(ri, ci).numFmt;
    const alreadyApplied = current === text && (typeof cell?.value === "number" || !/^general$/i.test(fmt?.trim() || "General"));
    if (alreadyApplied) {
      this.afterChange();
      return;
    }
    this.history.do(new SetCellTextCommand(this, ri, ci, text));
  }

  enterEdit(initial?: string): void {
    if (this.rejectLocked()) {
      return;
    }
    const control = this.sheet().getCellControl(this.selection.ri, this.selection.ci);
    if (control?.kind === "switch") {
      this.toggleSwitchCell();
      return;
    }
    if (control?.kind === "dropdown") {
      this.openCellDropdown();
      return;
    }
    this.clipboard.clear();
    const cell = this.sheet().getCell(this.selection.ri, this.selection.ci);
    this.editing = true;
    this.capture.value = "";
    this.capture.classList.remove("is-ime");
    this.root.classList.add("is-editing");
    const style = this.sheet().getCellStyle(this.selection.ri, this.selection.ci);
    this.editor.value = initial !== undefined ? initial : cellEditText(cell, style);
    this.editor.classList.add("is-on");
    this.placeEditor();
    this.editor.focus();
    if (initial !== undefined) {
      this.editor.setSelectionRange(this.editor.value.length, this.editor.value.length);
    } else {
      this.editor.select();
    }
    if (isFormulaText(this.editor.value)) {
      this.beginFormulaEdit("cell", this.editor.value, this.editor.selectionStart, "point");
    } else {
      this.render();
    }
    this.emitUi();
  }

  commitEdit(move: "down" | "up" | "right" | "left" | "none" = "none"): void {
    if (!this.editing) {
      return;
    }
    this.endFormulaEdit();
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
    this.endFormulaEdit();
    this.editing = false;
    this.editor.classList.remove("is-on");
    this.root.classList.remove("is-editing");
    this.editor.value = "";
    this.render();
    this.emitUi();
    this.focusCapture();
  }

  applyFormat(action: FormatAction): void {
    if (this.rejectLocked("range")) {
      return;
    }
    const ranges = this.selection.ranges().map((range) => range.clone());
    if (action.type === "clear") {
      this.history.do(new SetCellStyleCommand(this, ranges, "clear"));
      return;
    }
    const current = this.sheet().getCellStyle(this.selection.ri, this.selection.ci);
    const patch = formatToPatch(action, current);
    this.history.do(new SetCellStyleCommand(this, ranges, patch));
  }

  applyBorder(mode: BorderMode, color = "#000000"): void {
    if (this.rejectLocked("range")) {
      return;
    }
    this.history.do(new ApplyBorderCommand(this, this.selection.ranges().map((range) => range.clone()), mode, color));
  }

  mergeSelection(): void {
    if (this.rejectLocked("structure")) {
      return;
    }
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

  openFind(tab: "find" | "replace" = "find"): void {
    this.commitEdit("none");
    this.findUi.open(tab);
  }

  findNext(backward = false): void {
    this.findUi.findNext(backward);
  }

  revealCell(sheetIndex: number, ri: number, ci: number): void {
    this.commitEdit("none");
    if (sheetIndex !== this.workbook.activeIndex) {
      this.cellSelect.hide();
      this.workbook.setActive(sheetIndex);
      this.selectedImageId = undefined;
      this.cancelPaintFormat(false);
    }
    this.selection.set(ri, ci, this.sheet());
    this.ensureVisible();
    this.render();
    this.emitUi();
  }

  insertFunction(name: string): void {
    if (this.rejectLocked()) {
      return;
    }
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
    const items = sheet.autoFilter.items(
      ci,
      (ri, col) => cellDisplay(sheet.getCell(ri, col), sheet.getCellStyle(ri, col)),
      (ri, col) => sheet.getCellVerdict(ri, col),
      (ri, col) => sheet.getCellMark(ri, col),
    );
    const filter = sheet.autoFilter.getFilter(ci);
    const sort = sheet.autoFilter.getSort(ci);
    this.filterMenu.set(ci, items, filter?.value, sort?.order);
    const box = sheet.filterHeaderBox(sheet.autoFilter.hrange().sri, ci);
    const screen = cellScreenXY(sheet, box.x, box.y, this.scroll.scrollLeft, this.scroll.scrollTop);
    const rect = this.root.getBoundingClientRect();
    this.filterMenu.show(
      rect.left + screen.x,
      rect.top + screen.y + box.height + 2,
    );
  }

  unmergeSelection(): void {
    if (this.rejectLocked("structure")) {
      return;
    }
    this.history.do(new UnmergeCommand(this, this.selection.range));
  }

  insertRow(): void {
    if (this.rejectLocked("structure")) {
      return;
    }
    this.history.do(new InsertRowCommand(this, this.selection.range.sri, this.selection.range.rowCount()));
  }

  onRequestAppendRows: (() => void) | null = null;
  onRequestRenameSheet: ((index: number, currentName: string) => void) | null = null;
  onLockedEdit: (() => void) | null = null;

  appendRowsBelow(count: number): void {
    if (this.rejectLocked("structure")) {
      return;
    }
    const n = Math.min(500, Math.max(1, Math.floor(Number(count) || 1)));
    const index = this.selection.range.eri + 1;
    this.history.do(new InsertRowCommand(this, index, n));
    this.selection.set(index, this.selection.ci, this.sheet());
    this.afterChange();
  }

  insertColumn(): void {
    if (this.rejectLocked("structure")) {
      return;
    }
    this.history.do(new InsertColumnCommand(this, this.selection.range.sci, this.selection.range.colCount()));
  }

  deleteRow(): void {
    if (this.rejectLocked("structure")) {
      return;
    }
    this.history.do(new DeleteRowCommand(this, this.selection.range.sri, this.selection.range.rowCount()));
    this.selection.set(Math.min(this.selection.ri, this.sheet().rows.len - 1), this.selection.ci, this.sheet());
    this.afterChange();
  }

  deleteColumn(): void {
    if (this.rejectLocked("structure")) {
      return;
    }
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
    if (this.rejectLocked("structure")) {
      return;
    }
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
    if (this.rejectLocked("structure")) {
      return;
    }
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
    if (this.rejectLocked("range")) {
      return;
    }
    this.history.do(new ClearRangeCommand(this, this.selection.ranges().map((range) => range.clone())));
  }

  copy(mode: "copy" | "cut" = "copy"): string {
    const payload = this.clipboard.copy(this.sheet(), this.selection.ranges(), mode);
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
    if (this.rejectLocked("range")) {
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
    if (this.rejectLocked("range")) {
      return this.copy();
    }
    const text = this.copy("cut");
    this.history.do(new ClearRangeCommand(this, this.selection.ranges().map((range) => range.clone())));
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
    if (!this.canEditRange(range)) {
      this.onLockedEdit?.();
      return;
    }
    this.history.do(new PasteCommand(this, ri, ci, grid, range));
    this.selection.setRange(ri, ci, range.eri, range.eci, this.sheet());
  }

  applyFill(source: CellRange, dest: CellRange, axis: FillAxis): void {
    this.fillPreview = undefined;
    if (!this.canEditRange(dest)) {
      this.onLockedEdit?.();
      this.render();
      return;
    }
    if (source.equals(dest)) {
      this.render();
      return;
    }
    this.selection.setRange(dest.sri, dest.sci, dest.eri, dest.eci, this.sheet());
    this.history.do(new FillCommand(this, source.clone(), dest.clone(), axis));
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
    if (this.rejectLocked("structure")) {
      return;
    }
    this.workbook.addSheet();
    this.selection.set(0, 0);
    this.cancelEdit();
    this.afterChange();
  }

  switchSheet(index: number): void {
    if (index === this.workbook.activeIndex) {
      return;
    }
    this.commitEdit("none");
    this.cellSelect.hide();
    this.workbook.setActive(index);
    this.selection.set(0, 0, this.sheet());
    this.selectedImageId = undefined;
    this.cancelPaintFormat(false);
    this.afterChange();
  }

  renameSheet(index: number, name: string): boolean {
    if (this.rejectLocked("structure")) {
      return false;
    }
    const prev = this.workbook.sheets[index]?.name ?? "";
    if (!this.workbook.renameSheet(index, name)) {
      return false;
    }
    const next = this.workbook.sheets[index]?.name ?? name.trim();
    this.cellBadges.renameSheet(prev, next);
    this.afterChange();
    return true;
  }

  setSelectionPriority(priority: number): void {
    const next = parsePriorityMark(priority);
    if (!next) {
      return;
    }
    const allHave = this.selectionMarkOrigins().every((item) => this.sheet().getCellMark(item.ri, item.ci)?.priority === next);
    this.applySelectionMarks((current) => {
      const mark = { ...current };
      if (allHave) {
        delete mark.priority;
      } else {
        mark.priority = next;
      }
      return cloneMark(mark);
    });
  }

  setSelectionShape(shape: string): void {
    const next = parseShapeMark(shape);
    if (!next) {
      return;
    }
    const allHave = this.selectionMarkOrigins().every((item) => this.sheet().getCellMark(item.ri, item.ci)?.shape === next);
    this.applySelectionMarks((current) => {
      const mark = { ...current };
      if (allHave) {
        delete mark.shape;
      } else {
        mark.shape = next;
      }
      return cloneMark(mark);
    });
  }

  clearSelectionPriority(): void {
    this.applySelectionMarks((current) => cloneMark({ ...current, priority: undefined }));
  }

  clearSelectionShape(): void {
    this.applySelectionMarks((current) => cloneMark({ ...current, shape: undefined }));
  }

  setSelectionVerdict(verdict: string): void {
    const next = parseVerdictMark(verdict);
    if (!next) {
      return;
    }
    const allHave = this.selectionMarkOrigins().every((item) => this.sheet().getCellMark(item.ri, item.ci)?.verdict === next);
    this.applySelectionMarks((current) => {
      const mark = { ...current };
      if (allHave) {
        delete mark.verdict;
      } else {
        mark.verdict = next;
      }
      return cloneMark(mark);
    });
  }

  clearSelectionVerdict(): void {
    this.applySelectionMarks((current) => cloneMark({ ...current, verdict: undefined }));
  }

  unmarkSelection(): void {
    this.applySelectionMarks(() => undefined);
  }

  clearSheetMarks(): void {
    const patches = this.sheet().listCellMarks().map((item) => ({ ri: item.ri, ci: item.ci, mark: undefined }));
    if (!patches.length) {
      return;
    }
    this.history.do(new SetCellMarksCommand(this, patches));
  }

  private selectionMarkOrigins(): Array<{ ri: number; ci: number }> {
    const sheet = this.sheet();
    const seen = new Set<string>();
    const origins: Array<{ ri: number; ci: number }> = [];
    for (const range of this.selection.ranges()) {
      range.each((ri, ci) => {
        const origin = sheet.mergeOrigin(ri, ci);
        const key = `${origin.ri},${origin.ci}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        origins.push(origin);
      });
    }
    return origins;
  }

  private applySelectionMarks(mutate: (current?: CellMark) => CellMark | undefined): void {
    const sheet = this.sheet();
    const patches = this.selectionMarkOrigins().flatMap((item) => {
      const current = sheet.getCellMark(item.ri, item.ci);
      const next = mutate(current);
      if (marksEqual(current, next)) {
        return [];
      }
      return [{ ri: item.ri, ci: item.ci, mark: next }];
    });
    if (!patches.length) {
      return;
    }
    this.history.do(new SetCellMarksCommand(this, patches));
  }

  private uniformSelectionMark(): CellMark | undefined {
    const origins = this.selectionMarkOrigins();
    if (!origins.length) {
      return undefined;
    }
    const first = this.sheet().getCellMark(origins[0].ri, origins[0].ci);
    if (isEmptyMark(first) || !first) {
      return undefined;
    }
    const samePriority = origins.every((item) => this.sheet().getCellMark(item.ri, item.ci)?.priority === first.priority);
    const sameShape = origins.every((item) => this.sheet().getCellMark(item.ri, item.ci)?.shape === first.shape);
    const sameVerdict = origins.every((item) => this.sheet().getCellMark(item.ri, item.ci)?.verdict === first.verdict);
    return cloneMark({
      priority: samePriority ? first.priority : undefined,
      shape: sameShape ? first.shape : undefined,
      verdict: sameVerdict ? first.verdict : undefined,
    });
  }

  noteCell(): { ri: number; ci: number } {
    const origin = this.sheet().mergeOrigin(this.selection.ri, this.selection.ci);
    return { ri: origin.ri, ci: origin.ci };
  }

  editNote(): void {
    if (this.rejectLocked()) {
      return;
    }
    this.noteTip.hide();
    this.filterMenu.hide();
    this.cellSelect.hide();
    const { ri, ci } = this.noteCell();
    const text = cellNoteText(this.sheet().getCell(ri, ci));
    const rect = this.root.getBoundingClientRect();
    const screen = this.cellScreenRect();
    this.noteEditor.show(ri, ci, text, rect.left + screen.x + screen.width + 6, rect.top + screen.y);
  }

  private placeNoteEditor(): void {
    if (!this.noteEditor.open) {
      return;
    }
    const rect = this.root.getBoundingClientRect();
    const screen = this.cellScreenRect();
    this.noteEditor.move(rect.left + screen.x + screen.width + 6, rect.top + screen.y);
  }

  deleteNote(): void {
    const { ri, ci } = this.noteCell();
    this.setCellNote(ri, ci, "");
  }

  setCellNote(ri: number, ci: number, text: string): void {
    if (this.rejectLocked()) {
      return;
    }
    const current = cellNoteText(this.sheet().getCell(ri, ci));
    const next = text.trim();
    if (current === next) {
      return;
    }
    this.history.do(new SetCellNoteCommand(this, ri, ci, next));
  }

  showNoteTip(ri: number, ci: number, clientX: number, clientY: number): void {
    if (this.noteEditor.open) {
      this.noteTip.hide();
      return;
    }
    const origin = this.sheet().mergeOrigin(ri, ci);
    const text = cellNoteText(this.sheet().getCell(origin.ri, origin.ci));
    if (!text) {
      this.noteTip.hide();
      return;
    }
    this.noteTip.show(text, clientX + 12, clientY + 16);
  }

  hideNoteTip(): void {
    this.noteTip.hide();
  }

  setSelectionEditable(editable: boolean): void {
    if (!this.editControlEnabled()) return;
    for (const range of this.selection.ranges()) {
      this.sheet().setRangeEditable(range, editable);
    }
    this.afterChange();
  }

  setSelectionTextEdit(): void {
    if (!this.editControlEnabled()) return;
    for (const range of this.selection.ranges()) {
      this.sheet().setRangeEditable(range, true);
      this.sheet().setRangeControl(range, undefined);
    }
    this.afterChange();
  }

  setSelectionControl(control: CellControl): void {
    if (!this.editControlEnabled()) return;
    for (const range of this.selection.ranges()) {
      this.sheet().setRangeControl(range, control);
    }
    this.afterChange();
  }

  requestDropdownOptions(): void {
    if (!this.editControlEnabled()) return;
    const range = this.selection.range.clone();
    const current = this.sheet().getCellControl(this.selection.ri, this.selection.ci);
    const options = current?.kind === "dropdown" ? current.options : [];
    this.onRequestDropdownOptions?.(options, (next) => {
      this.sheet().setRangeControl(range, { kind: "dropdown", options: next });
      this.afterChange();
    });
  }

  toggleSwitchCell(): void {
    if (this.rejectLocked()) {
      return;
    }
    const { ri, ci } = this.selection;
    const sheet = this.sheet();
    if (sheet.getCellControl(ri, ci)?.kind !== "switch") {
      return;
    }
    const style = sheet.getCellStyle(ri, ci);
    const on = isSwitchOn(cellEditText(sheet.getCell(ri, ci), style));
    this.setCellText(switchCellText(!on));
  }

  openCellDropdown(): void {
    if (this.rejectLocked()) {
      return;
    }
    const { ri, ci } = this.selection;
    const sheet = this.sheet();
    const control = sheet.getCellControl(ri, ci);
    if (control?.kind !== "dropdown") {
      return;
    }
    const style = sheet.getCellStyle(ri, ci);
    const current = cellEditText(sheet.getCell(ri, ci), style);
    this.cellSelect.set(control.options, current);
    const box = sheet.cellBox(ri, ci);
    const screen = cellScreenXY(sheet, box.x, box.y, this.scroll.scrollLeft, this.scroll.scrollTop);
    const rect = this.root.getBoundingClientRect();
    this.cellSelect.show(rect.left + screen.x, rect.top + screen.y + box.height + 1, box.width);
  }

  controlHitAt(clientX: number, clientY: number): "dropdown" | "switch" | undefined {
    const rect = this.scroll.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const hit = this.hit.hit(this.sheet(), x, y, this.scrollX(), this.scrollY());
    if (hit?.kind !== "cell") {
      return undefined;
    }
    const control = this.sheet().getCellControl(hit.ri, hit.ci);
    if (!control) {
      return undefined;
    }
    const box = this.sheet().cellBox(hit.ri, hit.ci);
    const screen = cellScreenXY(this.sheet(), box.x, box.y, this.scroll.scrollLeft, this.scroll.scrollTop);
    const localX = x - screen.x;
    const localY = y - screen.y;
    if (control.kind === "dropdown" && hitDropdownControl(localX, localY, box.width, box.height)) {
      return "dropdown";
    }
    if (control.kind === "switch" && (hitSwitchControl(localX, localY, box.width, box.height) || !this.templateMode)) {
      return "switch";
    }
    return undefined;
  }

  markedRanges(): MarkedCellRange[] {
    const items: MarkedCellRange[] = [];
    for (const sheet of this.workbook.sheets) {
      for (const cell of sheet.listCellMarks()) {
        items.push({
          sheetName: sheet.name,
          range: xy2expr(cell.ci, cell.ri),
          ...(cell.mark.priority ? { priority: cell.mark.priority } : {}),
          ...(cell.mark.shape ? { shape: cell.mark.shape } : {}),
          ...(cell.mark.verdict ? { verdict: cell.mark.verdict } : {}),
        });
      }
    }
    return items;
  }

  applyCellPatches(items: Array<{
    sheetName: string;
    ref: string;
    text?: string;
    mark?: { priority?: unknown; shape?: unknown; verdict?: unknown } | null;
  }>): boolean {
    if (!items.length) return true;
    const valueTargets: Array<{ sheet: Sheet; ri: number; ci: number; text: string }> = [];
    const markPatches: Array<{ sheet: Sheet; ri: number; ci: number; mark?: CellMark }> = [];
    for (const item of items) {
      const wanted = item.sheetName.trim();
      const rawRef = item.ref.trim().toUpperCase();
      const bang = rawRef.lastIndexOf("!");
      const ref = bang >= 0 ? rawRef.slice(bang + 1) : rawRef;
      if (!wanted || !ref) return false;
      const [ci, ri] = expr2xy(ref);
      if (ci < 0 || ri < 0 || !Number.isFinite(ci) || !Number.isFinite(ri)) return false;
      const sheet =
        this.workbook.sheets.find((entry) => entry.name === wanted)
        ?? this.workbook.sheets.find((entry) => entry.name.trim() === wanted)
        ?? (items.every((patch) => patch.sheetName.trim() === wanted) ? this.sheet() : undefined);
      if (!sheet) return false;
      if (item.mark !== undefined) {
        const origin = sheet.mergeOrigin(ri, ci);
        markPatches.push({
          sheet,
          ri: origin.ri,
          ci: origin.ci,
          mark: cloneMark({
            priority: parsePriorityMark(item.mark?.priority),
            shape: parseShapeMark(item.mark?.shape),
            verdict: parseVerdictMark(item.mark?.verdict),
          }),
        });
        continue;
      }
      // Agent 补丁只同步服务端已写入的值，不受模版填报锁限制；锁失败会整表重载。
      valueTargets.push({ sheet, ri, ci, text: item.text ?? "" });
    }
    if (valueTargets.length) {
      this.history.do(new ApplyCellPatchesCommand(this, valueTargets));
    }
    if (markPatches.length) {
      this.history.do(new SetCellMarksCommand(this, markPatches, { persistOnHistory: true }));
    }
    const first = valueTargets[0] ?? markPatches[0];
    if (first) {
      const index = this.workbook.sheets.indexOf(first.sheet);
      if (index >= 0 && index !== this.workbook.activeIndex) {
        this.workbook.setActive(index);
      }
      this.selection.set(first.ri, first.ci, first.sheet);
      this.ensureVisible();
    }
    this.render();
    this.emitUi();
    return true;
  }

  applyReconcileBadges(items: ReconcileBadge[]): void {
    const bySheet = new Map<string, Array<{ ri: number; ci: number }>>();
    for (const item of items) {
      const sheetName = item.sheetName.trim();
      const ref = item.ref.trim().toUpperCase();
      if (!sheetName || !ref) continue;
      const [ci, ri] = expr2xy(ref);
      if (ci < 0 || ri < 0 || !Number.isFinite(ci) || !Number.isFinite(ri)) continue;
      const list = bySheet.get(sheetName) ?? [];
      list.push({ ri, ci });
      bySheet.set(sheetName, list);
    }
    for (const [sheetName, cells] of bySheet) {
      const wanted = sheetName.trim();
      const sheet =
        this.workbook.sheets.find((item) => item.name === wanted)
        ?? this.workbook.sheets.find((item) => item.name.trim() === wanted)
        ?? (bySheet.size === 1 ? this.sheet() : undefined);
      sheet?.setSessionCheckmarks(cells);
    }
    this.cellBadges.setChecks(items);
    this.sheet().refreshFilterView();
    this.render();
  }

  listSheetNames(): string[] {
    return this.workbook.sheets.map((sheet) => sheet.name).filter((name) => name !== CHECKMARKS_SHEET && name !== CELL_MARKS_SHEET);
  }

  getSheetHeaders(sheetName?: string): string[] {
    const wanted = sheetName?.trim();
    const sheet = (wanted ? this.workbook.sheets.find((item) => item.name === wanted) : undefined) ?? this.sheet();
    const headers: string[] = [];
    const seen = new Set<string>();
    for (let ci = 0; ci < sheet.cols.len; ci += 1) {
      const text = cellDisplay(sheet.getCell(0, ci), sheet.getCellStyle(0, ci)).replace(/\s+/g, " ").trim();
      const key = text.replace(/\s+/g, "");
      if (!text || seen.has(key)) continue;
      seen.add(key);
      headers.push(text);
    }
    return headers;
  }

  deleteSheet(index: number): boolean {
    if (this.rejectLocked("structure")) {
      return false;
    }
    if (this.workbook.sheets.length <= 1) {
      return false;
    }
    this.commitEdit("none");
    this.workbook.deleteSheet(index);
    this.selection.set(0, 0, this.sheet());
    this.selectedImageId = undefined;
    this.cancelPaintFormat(false);
    this.afterChange();
    return true;
  }

  deleteActiveSheet(): void {
    this.deleteSheet(this.workbook.activeIndex);
  }

  moveSheet(from: number, to: number): boolean {
    if (this.rejectLocked("structure")) {
      return false;
    }
    if (!this.workbook.moveSheet(from, to)) {
      return false;
    }
    this.afterChange();
    return true;
  }

  formatState(): FormatState {
    const style = this.sheet().getCellStyle(this.selection.ri, this.selection.ci);
    const cell = this.sheet().getCell(this.selection.ri, this.selection.ci);
    const uniformMark = this.uniformSelectionMark();
    const origins = this.selectionMarkOrigins();
    return {
      caption: this.caption,
      captionMeta: this.captionMeta,
      address: xy2expr(this.selection.ci, this.selection.ri),
      formula: this.formulaSession?.text ?? (this.editing ? this.editor.value : cellEditText(cell, style)),
      display: cellDisplay(cell, style),
      numFmt: style.numFmt ?? "General",
      fontFamily: style.font?.name ?? DEFAULT_STYLE.font.name ?? "Arial",
      fontSizePt: style.font?.size ?? 10,
      bold: !!style.font?.bold,
      italic: !!style.font?.italic,
      underline: !!style.underline,
      strike: !!style.strike,
      color: style.color ?? DEFAULT_STYLE.color,
      bgcolor: style.bgcolor ?? DEFAULT_STYLE.bgcolor,
      align: this.sheet().cellAlign(this.selection.ri, this.selection.ci),
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
      selectionPriority: uniformMark?.priority,
      selectionShape: uniformMark?.shape,
      selectionVerdict: uniformMark?.verdict,
      selectionMarked: origins.some((item) => !isEmptyMark(this.sheet().getCellMark(item.ri, item.ci))),
      selectionHasNote: !!cellNoteText(this.sheet().getCell(this.selection.ri, this.selection.ci)),
      markCount: this.workbook.sheets.reduce((total, sheet) => total + sheet.listCellMarks().length, 0),
      templateLocked: this.isFillLocked(),
      templateMode: this.templateMode,
      editControl: this.editControlEnabled(),
      selectionEditable: this.sheet().hasEditable(this.selection.ri, this.selection.ci),
      cellEditable: this.canEditCell(),
      cellControl: this.sheet().getCellControl(this.selection.ri, this.selection.ci)?.kind,
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
    const style = this.sheet().getCellStyle(this.selection.ri, this.selection.ci);
    this.editor.style.font = styleFontCss(style);
    this.editor.style.color = style.color ?? DEFAULT_STYLE.color;
    this.editor.style.textAlign = this.sheet().cellAlign(this.selection.ri, this.selection.ci);
    const markReserve = cellMarkBadgeReserve(
      rect.width,
      rect.height,
      this.sheet().displayCellMark(this.selection.ri, this.selection.ci),
    );
    this.editor.style.paddingRight = `${Math.max(4, markReserve)}px`;
    const wrapping = !!style.textwrap || hasExplicitBreak(this.editor.value);
    this.editor.classList.toggle("is-wrap", wrapping);
    this.editor.wrap = wrapping ? "soft" : "off";
    const available = Math.max(rect.width, this.root.clientWidth - rect.x - 8);
    const textWidth = this.measureEditorTextWidth(this.editor.value);
    const lineHeight = Number.parseFloat(getComputedStyle(this.editor).lineHeight) || 16;
    const sized = {
      cellWidth: rect.width,
      cellHeight: rect.height,
      textWidth,
      available,
      wrap: wrapping,
      lineHeight,
    };
    const { width } = editorBoxSize({ ...sized, lineCount: 1 });
    const lines = wrapping
      ? wrapLines(
        { measureText: (text) => editorMeasure.measureText(text || " ").width },
        this.editor.value,
        Math.max(1, width - 12),
        !!style.textwrap,
      ).length
      : 1;
    const { height } = editorBoxSize({ ...sized, lineCount: lines });
    this.editor.style.width = `${width}px`;
    this.editor.style.height = `${height}px`;
  }

  private measureEditorTextWidth(text: string): number {
    const style = getComputedStyle(this.editor);
    editorMeasure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    let max = 0;
    for (const line of text.split("\n")) {
      max = Math.max(max, editorMeasure.measureText(line || " ").width);
    }
    return max;
  }

  private syncSizer(): void {
    const sheet = this.sheet();
    this.sizer.style.width = `${INDEX_WIDTH + sheet.contentWidth()}px`;
    this.sizer.style.height = `${HEADER_HEIGHT + sheet.contentHeight()}px`;
  }

  private onScroll = (): void => {
    this.filterMenu.hide();
    this.cellSelect.hide();
    this.noteTip.hide();
    if (this.noteEditor.open) {
      this.placeNoteEditor();
    }
    if (this.editing) {
      this.placeEditor();
    }
    this.render();
  };

  private onResize = (): void => {
    this.render();
  };

  private onMenu(action: MenuAction, value?: string): void {
    if (action === "copy") {
      void navigator.clipboard.writeText(this.copy());
    } else if (action === "cut") {
      void navigator.clipboard.writeText(this.cut());
    } else if (action === "paste") {
      this.pasteInternal();
    } else if (action === "clear") {
      this.clearSelection();
    } else if (action === "find") {
      this.openFind("find");
    } else if (action === "insert-row") {
      this.insertRow();
    } else if (action === "append-row") {
      if (this.rejectLocked("structure")) {
        return;
      }
      if (this.onRequestAppendRows) {
        this.onRequestAppendRows();
      } else {
        this.appendRowsBelow(1);
      }
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
    } else if (action === "set-priority") {
      const priority = parsePriorityMark(value);
      if (priority) {
        this.setSelectionPriority(priority);
      }
    } else if (action === "set-shape") {
      const shape = parseShapeMark(value);
      if (shape) {
        this.setSelectionShape(shape);
      }
    } else if (action === "set-verdict") {
      const verdict = parseVerdictMark(value);
      if (verdict) {
        this.setSelectionVerdict(verdict);
      }
    } else if (action === "unmark") {
      this.unmarkSelection();
    } else if (action === "unmark-sheet") {
      this.clearSheetMarks();
    } else if (action === "edit-note") {
      this.editNote();
    } else if (action === "delete-note") {
      this.deleteNote();
    } else if (action === "allow-edit" || action === "control-text") {
      this.setSelectionTextEdit();
    } else if (action === "control-dropdown") {
      this.requestDropdownOptions();
    } else if (action === "control-switch") {
      this.setSelectionControl({ kind: "switch" });
    } else if (action === "deny-edit") {
      this.setSelectionEditable(false);
    }
  }
}

export interface FormatState {
  caption: string;
  captionMeta: Array<{ label: string; value: string }>;
  address: string;
  formula: string;
  display: string;
  numFmt: string;
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
  selectionPriority?: CellPriorityMark;
  selectionShape?: CellShapeMark;
  selectionVerdict?: CellVerdictMark;
  selectionMarked: boolean;
  selectionHasNote: boolean;
  markCount: number;
  templateLocked: boolean;
  templateMode: boolean;
  editControl: boolean;
  selectionEditable: boolean;
  cellEditable: boolean;
  cellControl?: "dropdown" | "switch";
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
  if (action.type === "numFmt") {
    return { numFmt: action.value, ...numericFormatAlign(action.value) };
  }
  if (action.type === "decimal") {
    return { numFmt: bumpDecimalPlaces(current.numFmt, action.value) };
  }
  return {};
}

function numericFormatAlign(code: string): Pick<CellStyle, "align"> {
  return isNumericDisplayFormat(code) ? { align: "right" } : {};
}

