import { HEADER_HEIGHT, INDEX_WIDTH } from "../shared/constants";
import type { CellRange } from "../model/CellRange";
import { CellRange as Range } from "../model/CellRange";
import type { Sheet } from "../model/Sheet";
import { hitAppliedScroll, cellScreenXY } from "../render/FreezePane";

export const FILL_HANDLE_SIZE = 8;
export const FILL_HANDLE_HIT = 12;
const MAX_FILL_INDEX = 9999;

export type FillAxis = "vertical" | "horizontal";

export function fillHandleBox(
  sheet: Sheet,
  range: CellRange,
  scrollX: number,
  scrollY: number,
): { x: number; y: number; size: number } {
  const contentX = sheet.colLeft(range.eci) + sheet.cols.getWidth(range.eci);
  const contentY = sheet.rowTop(range.eri) + sheet.rows.getHeight(range.eri);
  const corner = cellScreenXY(sheet, contentX, contentY, scrollX, scrollY);
  return {
    x: corner.x - FILL_HANDLE_SIZE / 2,
    y: corner.y - FILL_HANDLE_SIZE / 2,
    size: FILL_HANDLE_SIZE,
  };
}

export function hitFillHandle(
  sheet: Sheet,
  range: CellRange,
  x: number,
  y: number,
  scrollX: number,
  scrollY: number,
): boolean {
  const box = fillHandleBox(sheet, range, scrollX, scrollY);
  const pad = (FILL_HANDLE_HIT - box.size) / 2;
  return x >= box.x - pad && x <= box.x + box.size + pad && y >= box.y - pad && y <= box.y + box.size + pad;
}

export function hitFillTarget(
  sheet: Sheet,
  x: number,
  y: number,
  scrollX: number,
  scrollY: number,
): { ri: number; ci: number } | undefined {
  if (x < 0 || y < 0) {
    return undefined;
  }
  const applied = hitAppliedScroll(sheet, x, y, scrollX, scrollY);
  const contentX = applied.x + x - INDEX_WIDTH;
  const contentY = applied.y + y - HEADER_HEIGHT;
  const ci = indexAt(
    contentX,
    sheet.cols.len,
    (i) => sheet.cols.getWidth(i),
    sheet.colLeft(sheet.cols.len),
    sheet.cols.width,
  );
  const ri = indexAt(
    contentY,
    sheet.rows.len,
    (i) => sheet.rows.getHeight(i),
    sheet.contentHeight(),
    sheet.rows.height,
  );
  if (ri === undefined || ci === undefined) {
    return undefined;
  }
  return { ri: Math.min(ri, MAX_FILL_INDEX), ci: Math.min(ci, MAX_FILL_INDEX) };
}

export function resolveFillDest(source: CellRange, ri: number, ci: number): { dest: Range; axis: FillAxis } | null {
  if (source.includes(ri, ci)) {
    return null;
  }
  const inRows = ri >= source.sri && ri <= source.eri;
  const inCols = ci >= source.sci && ci <= source.eci;
  const vert = ri > source.eri ? ri - source.eri : ri < source.sri ? source.sri - ri : 0;
  const horz = ci > source.eci ? ci - source.eci : ci < source.sci ? source.sci - ci : 0;
  let axis: FillAxis;
  if (inCols && !inRows) {
    axis = "vertical";
  } else if (inRows && !inCols) {
    axis = "horizontal";
  } else if (vert >= horz) {
    axis = "vertical";
  } else {
    axis = "horizontal";
  }
  if (axis === "vertical") {
    const sri = Math.min(source.sri, ri);
    const eri = Math.max(source.eri, ri);
    if (sri === source.sri && eri === source.eri) {
      return null;
    }
    return { dest: new Range(sri, source.sci, eri, source.eci), axis };
  }
  const sci = Math.min(source.sci, ci);
  const eci = Math.max(source.eci, ci);
  if (sci === source.sci && eci === source.eci) {
    return null;
  }
  return { dest: new Range(source.sri, sci, source.eri, eci), axis };
}

function indexAt(
  offset: number,
  len: number,
  sizeAt: (index: number) => number,
  total: number,
  fallback: number,
): number | undefined {
  if (offset < 0) {
    return 0;
  }
  let pos = 0;
  for (let i = 0; i < len; i += 1) {
    const size = sizeAt(i);
    if (offset < pos + size) {
      return i;
    }
    pos += size;
  }
  const extra = Math.floor((offset - total) / Math.max(1, fallback));
  return len - 1 + Math.max(0, extra + 1);
}
