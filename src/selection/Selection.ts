import { CellRange } from "../model/CellRange";
import type { Sheet } from "../model/Sheet";
import { CellNavigator } from "./CellNavigator";

export class Selection {
  range = CellRange.cell(0, 0);
  ri = 0;
  ci = 0;
  focusRi = 0;
  focusCi = 0;

  set(ri: number, ci: number, sheet?: Sheet): void {
    const origin = sheet ? sheet.mergeOrigin(ri, ci) : { ri, ci };
    this.ri = origin.ri;
    this.ci = origin.ci;
    this.focusRi = origin.ri;
    this.focusCi = origin.ci;
    const merge = sheet?.merges.getFirstIncludes(origin.ri, origin.ci);
    this.range = merge ? merge.clone() : CellRange.cell(origin.ri, origin.ci);
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
    this.ri = ri;
    this.ci = 0;
    this.focusRi = ri;
    this.focusCi = colLen - 1;
    this.range = new CellRange(ri, 0, ri, colLen - 1);
  }

  selectCol(ci: number, rowLen: number): void {
    this.ri = 0;
    this.ci = ci;
    this.focusRi = rowLen - 1;
    this.focusCi = ci;
    this.range = new CellRange(0, ci, rowLen - 1, ci);
  }

  selectAll(rowLen: number, colLen: number): void {
    this.ri = 0;
    this.ci = 0;
    this.focusRi = rowLen - 1;
    this.focusCi = colLen - 1;
    this.range = new CellRange(0, 0, rowLen - 1, colLen - 1);
  }

  move(dri: number, dci: number, sheet: Sheet): void {
    const ri = clamp(this.ri + dri, 0, sheet.rows.len - 1);
    const ci = clamp(this.ci + dci, 0, sheet.cols.len - 1);
    this.set(ri, ci, sheet);
  }

  extend(dri: number, dci: number, sheet: Sheet): void {
    this.extendTo(this.focusRi + dri, this.focusCi + dci, sheet);
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
    next.ri = this.ri;
    next.ci = this.ci;
    next.focusRi = this.focusRi;
    next.focusCi = this.focusCi;
    return next;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
