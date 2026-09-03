import type { BorderStyle } from "../model/CellStyle";
import type { Sheet } from "../model/Sheet";

/** 合并格只画左上角，边框要从整块各边的格子汇总。 */
export function visibleBorder(sheet: Sheet, ri: number, ci: number): BorderStyle | undefined {
  const merge = sheet.merges.getFirstIncludes(ri, ci);
  if (!merge || !merge.multiple()) {
    return sheet.getCellStyle(ri, ci).border;
  }
  const border: BorderStyle = {};
  for (let c = merge.sci; c <= merge.eci; c += 1) {
    const top = sheet.getCellStyle(merge.sri, c).border?.top;
    const bottom = sheet.getCellStyle(merge.eri, c).border?.bottom;
    if (top) {
      border.top = top;
    }
    if (bottom) {
      border.bottom = bottom;
    }
  }
  for (let r = merge.sri; r <= merge.eri; r += 1) {
    const left = sheet.getCellStyle(r, merge.sci).border?.left;
    const right = sheet.getCellStyle(r, merge.eci).border?.right;
    if (left) {
      border.left = left;
    }
    if (right) {
      border.right = right;
    }
  }
  return border.top || border.right || border.bottom || border.left ? border : undefined;
}

/** 相邻格共用边只画一次：右/下优先，左/上让给邻居的右/下。 */
export function paintableBorder(sheet: Sheet, ri: number, ci: number): BorderStyle | undefined {
  const border = visibleBorder(sheet, ri, ci);
  if (!border) {
    return undefined;
  }
  const merge = sheet.merges.getFirstIncludes(ri, ci);
  const sri = merge?.sri ?? ri;
  const sci = merge?.sci ?? ci;
  const out: BorderStyle = {};
  if (border.right) {
    out.right = border.right;
  }
  if (border.bottom) {
    out.bottom = border.bottom;
  }
  if (border.top && !hasSide(sheet, prevVisibleRow(sheet, sri), sci, "bottom")) {
    out.top = border.top;
  }
  if (border.left && !hasSide(sheet, sri, sci - 1, "right")) {
    out.left = border.left;
  }
  return out.top || out.right || out.bottom || out.left ? out : undefined;
}

function hasSide(sheet: Sheet, ri: number | undefined, ci: number, side: keyof BorderStyle): boolean {
  if (ri === undefined || ri < 0 || ci < 0) {
    return false;
  }
  const origin = sheet.mergeOrigin(ri, ci);
  return !!visibleBorder(sheet, origin.ri, origin.ci)?.[side];
}

function prevVisibleRow(sheet: Sheet, ri: number): number | undefined {
  let prev: number | undefined;
  for (const index of sheet.eachViewRow()) {
    if (index >= ri) {
      return prev;
    }
    prev = index;
  }
  return prev;
}
