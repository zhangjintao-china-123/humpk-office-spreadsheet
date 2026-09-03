import {
  DEFAULT_COL_LEN,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_ROW_LEN,
  HEADER_HEIGHT,
  INDEX_WIDTH,
} from "../shared/constants";
import { type Cell, cellDisplay, cloneCell } from "./Cell";
import { imageRect } from "./SheetImage";
import { CellRange } from "./CellRange";
import {
  cloneBorder,
  cloneStyle,
  mergeStyle,
  resolveStyle,
  stylesEqual,
  type BorderStyle,
  type CellStyle,
} from "./CellStyle";
import { AutoFilter, type AutoFilterJson } from "./AutoFilter";
import { Cols } from "./Cols";
import { Merges } from "./Merges";
import { Rows } from "./Rows";
import { SheetImages } from "./SheetImages";

export class Sheet {
  name: string;
  styles: CellStyle[] = [];
  merges = new Merges();
  images = new SheetImages();
  autoFilter = new AutoFilter();
  /** 第一个可滚动行/列，[0,0] 表示未冻结。选 B3 冻结则为 [2, 1]。 */
  freeze: [number, number] = [0, 0];
  rows: Rows;
  cols: Cols;

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
    range.each((ri, ci) => {
      const current = this.getCellStyle(ri, ci);
      const next = mergeStyle(current, patch);
      const cell = this.rows.getCellOrNew(ri, ci);
      cell.style = this.addStyle(next);
    });
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

  refreshFilterView(): void {
    this.autoFilter.apply(this.rows.len, (ri, ci) => cellDisplay(this.getCell(ri, ci)));
  }

  captureFilter(): AutoFilterJson {
    return this.autoFilter.getData();
  }

  restoreFilter(json: AutoFilterJson): void {
    this.autoFilter.setData(json);
    this.refreshFilterView();
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
