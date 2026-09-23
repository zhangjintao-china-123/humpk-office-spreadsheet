import {
  CELL_PAD,
  DEFAULT_COL_LEN,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_ROW_LEN,
  HEADER_HEIGHT,
  INDEX_WIDTH,
} from "../shared/constants";
import { type Cell, cellDisplay, cloneCell, effectiveAlign, materializeTextFormat } from "./Cell";
import { isTextFormat } from "./NumberFormat";
import { hasExplicitBreak, measurerForStyle, wrapLines, wrappedBlockHeight } from "../render/textLayout";
import { imageRect } from "./SheetImage";
import { CellRange } from "./CellRange";
import {
  cloneBorder,
  cloneStyle,
  mergeStyle,
  resolveStyle,
  stylesEqual,
  type Align,
  type BorderStyle,
  type CellStyle,
} from "./CellStyle";
import { AutoFilter, skipFilterBannerRows, type AutoFilterJson, type FilterVerdict } from "./AutoFilter";
import { cloneCellControl, type CellControl } from "./CellControl";
import { cloneMark, isEmptyMark, type CellMark, type CellVerdictMark } from "./CellMarks";
import { Cols } from "./Cols";
import { Merges } from "./Merges";
import { Rows } from "./Rows";
import { SheetImages } from "./SheetImages";

export class Sheet {
  name: string;
  table?: string;
  filters?: Record<string, string | number>;
  styles: CellStyle[] = [];
  merges = new Merges();
  images = new SheetImages();
  autoFilter = new AutoFilter();
  /** 第一个可滚动行/列，[0,0] 表示未冻结。选 B3 冻结则为 [2, 1]。 */
  freeze: [number, number] = [0, 0];
  rows: Rows;
  cols: Cols;
  private persistedCheckmarks = new Set<string>();
  private sessionCheckmarks = new Set<string>();
  private editableCells = new Set<string>();
  private cellControls = new Map<string, CellControl>();
  private cellMarks = new Map<string, CellMark>();

  constructor(name: string, rowLen = DEFAULT_ROW_LEN, colLen = DEFAULT_COL_LEN) {
    this.name = name;
    this.rows = new Rows(rowLen, DEFAULT_ROW_HEIGHT);
    this.cols = new Cols(colLen, DEFAULT_COL_WIDTH);
  }

  getCell(ri: number, ci: number): Cell | undefined {
    return this.rows.getCell(ri, ci);
  }

  getCellStyle(ri: number, ci: number): CellStyle {
    const index = this.getCell(ri, ci)?.style;
    return resolveStyle(index === undefined ? undefined : this.styles[index]);
  }

  cellAlign(ri: number, ci: number): Align {
    return effectiveAlign(this.getCell(ri, ci), this.rawStyle(ri, ci), this.getCellStyle(ri, ci));
  }

  rawStyle(ri: number, ci: number): CellStyle {
    const index = this.getCell(ri, ci)?.style;
    return index === undefined ? {} : cloneStyle(this.styles[index] ?? {});
  }

  setCellBorder(ri: number, ci: number, patch: BorderStyle | undefined): void {
    const cell = this.rows.getCellOrNew(ri, ci);
    const raw = this.rawStyle(ri, ci);
    if (patch === undefined) {
      delete raw.border;
    } else {
      raw.border = { ...cloneBorder(raw.border), ...cloneBorder(patch) };
    }
    cell.style = this.addStyle(raw);
  }

  findStyleIndex(style: CellStyle): number {
    return this.styles.findIndex((item) => stylesEqual(item, style));
  }

  addStyle(style: CellStyle): number {
    const found = this.findStyleIndex(style);
    if (found >= 0) {
      return found;
    }
    this.styles.push(cloneStyle(style));
    return this.styles.length - 1;
  }

  applyStylePatch(range: CellRange, patch: CellStyle): Map<string, Cell | undefined> {
    const before = this.snapshotCells(range);
    const toText = isTextFormat(patch.numFmt);
    range.each((ri, ci) => {
      const current = this.getCellStyle(ri, ci);
      const next = mergeStyle(current, patch);
      const cell = this.rows.getCellOrNew(ri, ci);
      cell.style = this.addStyle(next);
      if (toText && !isTextFormat(current.numFmt)) {
        materializeTextFormat(cell);
      }
    });
    if (patch.textwrap) {
      this.growRowsToFit(range);
    }
    return before;
  }

  clearStyle(range: CellRange): Map<string, Cell | undefined> {
    const before = this.snapshotCells(range);
    range.each((ri, ci) => {
      const cell = this.getCell(ri, ci);
      if (cell) {
        delete cell.style;
        this.rows.setCell(ri, ci, cell);
      }
    });
    return before;
  }

  snapshotCells(range: CellRange): Map<string, Cell | undefined> {
    const map = new Map<string, Cell | undefined>();
    range.each((ri, ci) => {
      map.set(`${ri},${ci}`, cloneCell(this.getCell(ri, ci)));
    });
    return map;
  }

  restoreCells(snapshot: Map<string, Cell | undefined>): void {
    for (const [key, cell] of snapshot) {
      const [ri, ci] = key.split(",").map(Number);
      this.rows.setCell(ri, ci, cloneCell(cell));
    }
  }

  merge(range: CellRange): void {
    if (!range.multiple()) {
      return;
    }
    this.merges.add(range);
    const origin = this.rows.getCellOrNew(range.sri, range.sci);
    origin.merge = [range.rowCount() - 1, range.colCount() - 1];
    range.each((ri, ci) => {
      if (ri === range.sri && ci === range.sci) {
        return;
      }
      const cell = this.getCell(ri, ci);
      if (cell) {
        delete cell.merge;
      }
    });
  }

  unmerge(range: CellRange): CellRange | undefined {
    const found = this.merges.getFirstIncludes(range.sri, range.sci);
    if (!found) {
      return undefined;
    }
    this.merges.deleteWithin(found);
    const origin = this.getCell(found.sri, found.sci);
    if (origin) {
      delete origin.merge;
      this.rows.setCell(found.sri, found.sci, origin);
    }
    return found;
  }

  isRowHidden(ri: number): boolean {
    return this.autoFilter.hiddenRows.has(ri);
  }

  hasCheckmark(ri: number, ci: number): boolean {
    return this.getCellVerdict(ri, ci) === "pass";
  }

  getCellVerdict(ri: number, ci: number): FilterVerdict {
    const mark = this.getCellMark(ri, ci);
    if (mark?.verdict === "pass" || mark?.verdict === "fail") {
      return mark.verdict;
    }
    const key = checkmarkKey(ri, ci);
    if (this.persistedCheckmarks.has(key) || this.sessionCheckmarks.has(key)) {
      return "pass";
    }
    return "none";
  }

  setCheckmarks(cells: Array<{ ri: number; ci: number }>): void {
    this.sessionCheckmarks.clear();
    this.mergeVerdict("pass", cells, false);
    this.persistedCheckmarks = toCheckmarkSet(cells.filter((cell) => this.getCellVerdict(cell.ri, cell.ci) === "pass"));
  }

  setSessionCheckmarks(cells: Array<{ ri: number; ci: number }>): void {
    this.clearVerdict("pass");
    this.sessionCheckmarks = toCheckmarkSet(cells);
    this.persistedCheckmarks.clear();
    this.mergeVerdict("pass", cells, true);
  }

  listCheckmarks(): Array<{ ri: number; ci: number }> {
    return this.listVerdictCells("pass");
  }

  listPersistedCheckmarks(): Array<{ ri: number; ci: number }> {
    const keys = new Set(this.persistedCheckmarks);
    for (const item of this.listCellMarks()) {
      const key = checkmarkKey(item.ri, item.ci);
      if (item.mark.verdict === "pass" && !this.sessionCheckmarks.has(key)) {
        keys.add(key);
      } else if (item.mark.verdict) {
        keys.delete(key);
      }
    }
    return keysToCheckmarks(keys);
  }

  commitSessionCheckmarks(): void {
    for (const key of this.sessionCheckmarks) {
      this.persistedCheckmarks.add(key);
    }
    this.sessionCheckmarks.clear();
  }

  private mergeVerdict(verdict: CellVerdictMark, cells: Array<{ ri: number; ci: number }>, overwrite: boolean): void {
    for (const cell of cells) {
      if (cell.ri < 0 || cell.ci < 0) {
        continue;
      }
      const current = this.getCellMark(cell.ri, cell.ci) ?? {};
      if (!overwrite && current.verdict) {
        continue;
      }
      this.setCellMark(cell.ri, cell.ci, { ...current, verdict });
    }
  }

  private clearVerdict(verdict: CellVerdictMark): void {
    for (const item of this.listCellMarks()) {
      if (item.mark.verdict === verdict) {
        this.setCellMark(item.ri, item.ci, { ...item.mark, verdict: undefined });
      }
    }
  }

  private listVerdictCells(verdict: CellVerdictMark): Array<{ ri: number; ci: number }> {
    const keys = new Set<string>();
    if (verdict === "pass") {
      for (const key of this.persistedCheckmarks) keys.add(key);
      for (const key of this.sessionCheckmarks) keys.add(key);
    }
    for (const item of this.listCellMarks()) {
      const key = checkmarkKey(item.ri, item.ci);
      if (item.mark.verdict === verdict) {
        keys.add(key);
      } else if (verdict === "pass" && item.mark.verdict) {
        keys.delete(key);
      }
    }
    return keysToCheckmarks(keys);
  }

  hasEditable(ri: number, ci: number): boolean {
    return this.editableCells.has(checkmarkKey(ri, ci));
  }

  setEditableCells(cells: Array<{ ri: number; ci: number }>): void {
    this.editableCells = toCheckmarkSet(cells);
  }

  listEditableCells(): Array<{ ri: number; ci: number }> {
    return keysToCheckmarks(this.editableCells);
  }

  setCellEditable(ri: number, ci: number, editable: boolean): void {
    const key = checkmarkKey(ri, ci);
    if (editable) {
      this.editableCells.add(key);
    } else {
      this.editableCells.delete(key);
      this.cellControls.delete(key);
    }
  }

  setRangeEditable(range: { sri: number; sci: number; eri: number; eci: number }, editable: boolean): void {
    for (let ri = range.sri; ri <= range.eri; ri += 1) {
      for (let ci = range.sci; ci <= range.eci; ci += 1) {
        this.setCellEditable(ri, ci, editable);
      }
    }
  }

  getCellMark(ri: number, ci: number): CellMark | undefined {
    return cloneMark(this.cellMarks.get(checkmarkKey(ri, ci)));
  }

  displayCellMark(ri: number, ci: number): CellMark | undefined {
    const verdict = this.getCellVerdict(ri, ci);
    return cloneMark({
      ...this.getCellMark(ri, ci),
      ...(verdict === "none" ? {} : { verdict }),
    });
  }

  setCellMark(ri: number, ci: number, mark?: CellMark): void {
    const key = checkmarkKey(ri, ci);
    const next = cloneMark(mark);
    if (!next || isEmptyMark(next)) {
      this.cellMarks.delete(key);
      this.persistedCheckmarks.delete(key);
      this.sessionCheckmarks.delete(key);
      return;
    }
    this.cellMarks.set(key, next);
    if (next.verdict !== "pass") {
      this.persistedCheckmarks.delete(key);
      this.sessionCheckmarks.delete(key);
    }
  }

  setCellMarks(items: Array<{ ri: number; ci: number; mark?: CellMark }>): void {
    this.cellMarks.clear();
    for (const item of items) {
      this.setCellMark(item.ri, item.ci, item.mark);
    }
  }

  listCellMarks(): Array<{ ri: number; ci: number; mark: CellMark }> {
    return [...this.cellMarks.entries()]
      .flatMap(([key, mark]) => {
        const next = cloneMark(mark);
        if (!next) {
          return [];
        }
        const [ri, ci] = key.split(",").map(Number);
        return [{ ri, ci, mark: next }];
      })
      .sort((a, b) => a.ri - b.ri || a.ci - b.ci);
  }

  clearCellMarks(): void {
    this.cellMarks.clear();
  }

  getCellControl(ri: number, ci: number): CellControl | undefined {
    return this.cellControls.get(checkmarkKey(ri, ci));
  }

  setCellControl(ri: number, ci: number, control: CellControl | undefined): void {
    const key = checkmarkKey(ri, ci);
    if (!control) {
      this.cellControls.delete(key);
      return;
    }
    this.editableCells.add(key);
    this.cellControls.set(key, cloneCellControl(control));
  }

  setRangeControl(range: { sri: number; sci: number; eri: number; eci: number }, control: CellControl | undefined): void {
    for (let ri = range.sri; ri <= range.eri; ri += 1) {
      for (let ci = range.sci; ci <= range.eci; ci += 1) {
        this.setCellControl(ri, ci, control);
      }
    }
  }

  setCellControls(items: Array<{ ri: number; ci: number; control: CellControl }>): void {
    this.cellControls.clear();
    for (const item of items) {
      this.setCellControl(item.ri, item.ci, item.control);
    }
  }

  listCellControls(): Array<{ ri: number; ci: number; control: CellControl }> {
    return [...this.cellControls.entries()].map(([key, control]) => {
      const [ri, ci] = key.split(",").map(Number);
      return { ri, ci, control: cloneCellControl(control) };
    });
  }

  refreshFilterView(): void {
    this.autoFilter.apply(
      this.rows.len,
      (ri, ci) => cellDisplay(this.getCell(ri, ci), this.getCellStyle(ri, ci)),
      (ri, ci) => this.getCellVerdict(ri, ci),
      (ri, ci) => this.getCellMark(ri, ci),
    );
  }

  captureFilter(): AutoFilterJson {
    return this.autoFilter.getData();
  }

  restoreFilter(json: AutoFilterJson): void {
    this.autoFilter.setData(json);
    this.refreshFilterView();
  }

  alignAutoFilterHeader(): void {
    if (!this.autoFilter.ref) {
      return;
    }
    const next = skipFilterBannerRows(
      this.autoFilter.range(),
      (ri, ci) => !!cellDisplay(this.getCell(ri, ci), this.getCellStyle(ri, ci)),
      (ri, ci) => this.merges.getFirstIncludes(ri, ci),
    );
    this.autoFilter.ref = next.toString();
  }

  freezeIsActive(): boolean {
    return this.freeze[0] > 0 || this.freeze[1] > 0;
  }

  freezeTotalWidth(): number {
    return this.colLeft(this.freeze[1]);
  }

  freezeTotalHeight(): number {
    const fri = this.freeze[0];
    let height = 0;
    for (const ri of this.eachViewRow()) {
      if (ri >= fri) {
        break;
      }
      height += this.rows.getHeight(ri);
    }
    return height;
  }

  setFreeze(ri: number, ci: number): void {
    this.freeze = [Math.max(0, ri), Math.max(0, ci)];
  }

  shiftFreeze(axis: "row" | "column", index: number, count: number): void {
    const slot = axis === "row" ? 0 : 1;
    if (this.freeze[slot] <= index) {
      return;
    }
    if (count >= 0) {
      this.freeze[slot] += count;
      return;
    }
    this.freeze[slot] = Math.max(index, this.freeze[slot] + count);
  }

  colLeft(ci: number): number {
    let x = 0;
    for (let i = 0; i < ci; i += 1) {
      x += this.cols.getWidth(i);
    }
    return x;
  }

  rowTop(ri: number): number {
    let y = 0;
    for (const index of this.eachViewRow()) {
      if (index === ri) {
        return y;
      }
      y += this.rows.getHeight(index);
    }
    return y;
  }

  contentWidth(): number {
    return this.colLeft(this.cols.len);
  }

  contentHeight(): number {
    let height = 0;
    for (const ri of this.eachViewRow()) {
      height += this.rows.getHeight(ri);
    }
    return height;
  }

  *eachViewRow(): Generator<number> {
    const view = this.autoFilter.viewRows;
    if (this.autoFilter.active() && view.length > 0) {
      for (const ri of view) {
        yield ri;
      }
      return;
    }
    for (let ri = 0; ri < this.rows.len; ri += 1) {
      if (!this.isRowHidden(ri)) {
        yield ri;
      }
    }
  }

  visibleRowsInView(scrollY: number, viewH: number): Array<{ ri: number; top: number; height: number }> {
    const rows: Array<{ ri: number; top: number; height: number }> = [];
    let top = 0;
    for (const ri of this.eachViewRow()) {
      const height = this.rows.getHeight(ri);
      if (top + height >= scrollY && top <= scrollY + viewH) {
        rows.push({ ri, top, height });
      }
      top += height;
      if (top > scrollY + viewH) {
        break;
      }
    }
    return rows;
  }

  findColAt(offsetX: number): { ci: number; left: number; width: number } | undefined {
    let left = 0;
    for (let ci = 0; ci < this.cols.len; ci += 1) {
      const width = this.cols.getWidth(ci);
      if (offsetX < left + width) {
        return { ci, left, width };
      }
      left += width;
    }
    return undefined;
  }

  findRowAt(offsetY: number): { ri: number; top: number; height: number } | undefined {
    let top = 0;
    for (const ri of this.eachViewRow()) {
      const height = this.rows.getHeight(ri);
      if (offsetY < top + height) {
        return { ri, top, height };
      }
      top += height;
    }
    return undefined;
  }

  visibleRange(scrollX: number, scrollY: number, viewW: number, viewH: number): CellRange {
    const startCol = this.findColAt(scrollX);
    const startRow = this.findRowAt(scrollY);
    const endCol = this.findColAt(scrollX + viewW) ?? { ci: this.cols.len - 1 };
    const endRow = this.findRowAt(scrollY + viewH) ?? { ri: this.rows.len - 1 };
    return new CellRange(
      startRow?.ri ?? 0,
      startCol?.ci ?? 0,
      endRow.ri,
      endCol.ci,
    );
  }

  mergeOrigin(ri: number, ci: number): { ri: number; ci: number } {
    const merge = this.merges.getFirstIncludes(ri, ci);
    return merge ? { ri: merge.sri, ci: merge.sci } : { ri, ci };
  }

  usedRange(): CellRange | undefined {
    let eri = -1;
    let eci = -1;
    this.rows.each((ri, row) => {
      if (!row.cells) {
        return;
      }
      for (const [key, cell] of Object.entries(row.cells)) {
        if (!cellOccupied(cell)) {
          continue;
        }
        eri = Math.max(eri, ri);
        eci = Math.max(eci, Number(key));
      }
    });
    this.merges.forEach((range) => {
      eri = Math.max(eri, range.eri);
      eci = Math.max(eci, range.eci);
    });
    for (const image of this.images.list()) {
      const rect = imageRect(image);
      const right = this.findColAt(rect.x + rect.width - INDEX_WIDTH) ?? { ci: this.cols.len - 1 };
      const bottom = this.findRowAt(rect.y + rect.height - HEADER_HEIGHT) ?? { ri: this.rows.len - 1 };
      eci = Math.max(eci, right.ci);
      eri = Math.max(eri, bottom.ri);
    }
    if (eri < 0 || eci < 0) {
      return undefined;
    }
    return new CellRange(0, 0, eri, eci);
  }

  growRowsToFit(range: CellRange): void {
    const needed = new Map<number, number>();
    range.each((ri, ci) => {
      const style = this.getCellStyle(ri, ci);
      const text = cellDisplay(this.getCell(ri, ci), style);
      if (!text) {
        return;
      }
      const wrap = !!style.textwrap;
      if (!wrap && !hasExplicitBreak(text)) {
        return;
      }
      const width = Math.max(1, this.cellBox(ri, ci).width - CELL_PAD * 2);
      const lines = wrapLines(measurerForStyle(style), text, width, wrap);
      const height = wrappedBlockHeight(lines.length, style);
      needed.set(ri, Math.max(needed.get(ri) ?? 0, height));
    });
    for (const [ri, height] of needed) {
      if (this.rows.getHeight(ri) < height) {
        this.rows.setHeight(ri, height);
      }
    }
  }

  filterHeaderBox(ri: number, ci: number): { x: number; y: number; width: number; height: number } {
    return {
      x: this.colLeft(ci),
      y: this.rowTop(ri),
      width: this.cols.getWidth(ci),
      height: this.rows.getHeight(ri),
    };
  }

  cellBox(ri: number, ci: number): { x: number; y: number; width: number; height: number } {
    const merge = this.merges.getFirstIncludes(ri, ci);
    const sri = merge?.sri ?? ri;
    const sci = merge?.sci ?? ci;
    const eri = merge?.eri ?? ri;
    const eci = merge?.eci ?? ci;
    let width = 0;
    let height = 0;
    for (let c = sci; c <= eci; c += 1) {
      width += this.cols.getWidth(c);
    }
    for (let r = sri; r <= eri; r += 1) {
      if (!this.isRowHidden(r)) {
        height += this.rows.getHeight(r);
      }
    }
    return {
      x: this.colLeft(sci),
      y: this.rowTop(sri),
      width,
      height,
    };
  }
}

function cellOccupied(cell: Cell): boolean {
  return !!(cell.text || cell.value !== undefined || cell.style !== undefined || cell.merge);
}

function checkmarkKey(ri: number, ci: number): string {
  return `${ri},${ci}`;
}

function toCheckmarkSet(cells: Array<{ ri: number; ci: number }>): Set<string> {
  return new Set(
    cells
      .filter((item) => item.ri >= 0 && item.ci >= 0)
      .map((item) => checkmarkKey(item.ri, item.ci)),
  );
}

function keysToCheckmarks(keys: Set<string>): Array<{ ri: number; ci: number }> {
  return [...keys].map((key) => {
    const [ri, ci] = key.split(",").map(Number);
    return { ri, ci };
  });
}
