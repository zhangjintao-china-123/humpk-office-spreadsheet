import type { Sheet } from "../model/Sheet";

/** 横线在格子上/下边。合并内部的边不画。 */
export function hidesHGrid(sheet: Sheet, ri: number, ci: number, edge: "top" | "bottom"): boolean {
  const merge = sheet.merges.getFirstIncludes(ri, ci);
  if (!merge || !merge.multiple()) {
    return false;
  }
  return edge === "bottom" ? merge.eri > ri : merge.sri < ri;
}

/** 竖线在列 boundaryCi 的左边。合并内部的边不画。 */
export function hidesVGrid(sheet: Sheet, ri: number, boundaryCi: number): boolean {
  if (boundaryCi <= 0) {
    return false;
  }
  const left = sheet.merges.getFirstIncludes(ri, boundaryCi - 1);
  return !!left && left.multiple() && left.eci >= boundaryCi;
}
