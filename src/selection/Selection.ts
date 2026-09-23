import { CellRange } from "../model/CellRange";
import type { Sheet } from "../model/Sheet";
import { CellNavigator } from "./CellNavigator";

export type AdditiveResult = "added" | "removed" | "kept";

export class Selection {
  range = CellRange.cell(0, 0);
  extras: CellRange[] = [];
  ri = 0;
  ci = 0;
  focusRi = 0;
  focusCi = 0;

  ranges(): CellRange[] {
    return [this.range, ...this.extras];
  }

  includesCell(ri: number, ci: number): boolean {
    return this.ranges().some((range) => range.includes(ri, ci));
  }

  coversRow(ri: number): boolean {
    return this.ranges().some((range) => range.sri <= ri && ri <= range.eri);
  }

  coversCol(ci: number): boolean {
    return this.ranges().some((range) => range.sci <= ci && ci <= range.eci);
  }

  set(ri: number, ci: number, sheet?: Sheet): void {
    this.extras = [];
    this.assignCell(ri, ci, sheet);
  }

  setRange(sri: number, sci: number, eri: number, eci: number, sheet?: Sheet): void {
    this.ri = sri;
    this.ci = sci;
    this.focusRi = eri;
    this.focusCi = eci;
    let range = new CellRange(sri, sci, eri, eci);
    if (sheet) {
      sheet.merges.forEach((merge) => {
        if (merge.intersects(range)) {
          range = range.union(merge);
        }
      });
    }
    this.range = range;
  }

  selectRow(ri: number, colLen: number): void {
    this.extras = [];
    this.assignRows(ri, ri, colLen);
  }

  selectRows(sri: number, eri: number, colLen: number): void {
    this.assignRows(sri, eri, colLen);
  }

  selectCol(ci: number, rowLen: number): void {
    this.extras = [];
    this.assignCols(ci, ci, rowLen);
  }

  selectCols(sci: number, eci: number, rowLen: number): void {
    this.assignCols(sci, eci, rowLen);
  }

  selectAll(rowLen: number, colLen: number): void {
    this.extras = [];
    this.ri = 0;
    this.ci = 0;
    this.focusRi = rowLen - 1;
    this.focusCi = colLen - 1;
    this.range = new CellRange(0, 0, rowLen - 1, colLen - 1);
  }

  addOrToggleCell(ri: number, ci: number, sheet?: Sheet): AdditiveResult {
    return this.addOrToggle(cellRangeAt(ri, ci, sheet), () => this.assignCell(ri, ci, sheet));
  }

  addOrToggleRow(ri: number, colLen: number): AdditiveResult {
    return this.addOrToggle(new CellRange(ri, 0, ri, colLen - 1), () => this.assignRows(ri, ri, colLen));
  }

  addOrToggleCol(ci: number, rowLen: number): AdditiveResult {
    return this.addOrToggle(new CellRange(0, ci, rowLen - 1, ci), () => this.assignCols(ci, ci, rowLen));
  }

  move(dri: number, dci: number, sheet: Sheet): void {
    const next = CellNavigator.step(sheet, this.ri, this.ci, dri, dci);
    this.set(next.ri, next.ci, sheet);
  }

  extend(dri: number, dci: number, sheet: Sheet): void {
    const next = CellNavigator.step(sheet, this.focusRi, this.focusCi, dri, dci);
    this.extendTo(next.ri, next.ci, sheet);
  }

  extendTo(ri: number, ci: number, sheet: Sheet): void {
    const nextRi = clamp(ri, 0, sheet.rows.len - 1);
    const nextCi = clamp(ci, 0, sheet.cols.len - 1);
    this.setRange(this.ri, this.ci, nextRi, nextCi, sheet);
  }

  jump(dri: number, dci: number, sheet: Sheet): void {
    const next = CellNavigator.edge(sheet, this.ri, this.ci, dri, dci);
    this.set(next.ri, next.ci, sheet);
  }

  jumpExtend(dri: number, dci: number, sheet: Sheet): void {
    const next = CellNavigator.edge(sheet, this.focusRi, this.focusCi, dri, dci);
    this.extendTo(next.ri, next.ci, sheet);
  }

  clone(): Selection {
    const next = new Selection();
    next.range = this.range.clone();
    next.extras = this.extras.map((range) => range.clone());
    next.ri = this.ri;
    next.ci = this.ci;
    next.focusRi = this.focusRi;
    next.focusCi = this.focusCi;
    return next;
  }

  private assignCell(ri: number, ci: number, sheet?: Sheet): void {
    const origin = sheet ? sheet.mergeOrigin(ri, ci) : { ri, ci };
    this.ri = origin.ri;
    this.ci = origin.ci;
    this.focusRi = origin.ri;
    this.focusCi = origin.ci;
    const merge = sheet?.merges.getFirstIncludes(origin.ri, origin.ci);
    this.range = merge ? merge.clone() : CellRange.cell(origin.ri, origin.ci);
  }

  private assignRows(sri: number, eri: number, colLen: number): void {
    this.ri = sri;
    this.ci = 0;
    this.focusRi = eri;
    this.focusCi = colLen - 1;
    this.range = new CellRange(sri, 0, eri, colLen - 1);
  }

  private assignCols(sci: number, eci: number, rowLen: number): void {
    this.ri = 0;
    this.ci = sci;
    this.focusRi = rowLen - 1;
    this.focusCi = eci;
    this.range = new CellRange(0, sci, rowLen - 1, eci);
  }

  private addOrToggle(next: CellRange, assign: () => void): AdditiveResult {
    if (this.range.equals(next)) {
      if (this.extras.length === 0) {
        return "kept";
      }
      const last = this.extras.pop()!;
      this.ri = last.sri;
      this.ci = last.sci;
      this.focusRi = last.eri;
      this.focusCi = last.eci;
      this.range = last;
      return "removed";
    }
    const extraIndex = this.extras.findIndex((range) => range.equals(next));
    if (extraIndex >= 0) {
      this.extras.splice(extraIndex, 1);
      return "removed";
    }
    this.extras.push(this.range.clone());
    assign();
    return "added";
  }
}

function cellRangeAt(ri: number, ci: number, sheet?: Sheet): CellRange {
  const origin = sheet ? sheet.mergeOrigin(ri, ci) : { ri, ci };
  const merge = sheet?.merges.getFirstIncludes(origin.ri, origin.ci);
  return merge ? merge.clone() : CellRange.cell(origin.ri, origin.ci);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
