import { hitAppliedScroll } from "../render/FreezePane";
import { FILTER_HIT, HEADER_HEIGHT, INDEX_WIDTH, RESIZE_HIT } from "../shared/constants";
import type { Sheet } from "../model/Sheet";

export type HitKind = "cell" | "row-header" | "col-header" | "corner" | "row-resize" | "col-resize" | "filter-button";

export interface Hit {
  kind: HitKind;
  ri: number;
  ci: number;
  index?: number;
}

export class HitTester {
  hit(sheet: Sheet, x: number, y: number, scrollX: number, scrollY: number): Hit | undefined {
    if (x < 0 || y < 0) {
      return undefined;
    }
    const applied = hitAppliedScroll(sheet, x, y, scrollX, scrollY);
    if (x < INDEX_WIDTH && y < HEADER_HEIGHT) {
      return { kind: "corner", ri: 0, ci: 0 };
    }
    if (y < HEADER_HEIGHT) {
      const col = sheet.findColAt(applied.x + x - INDEX_WIDTH);
      if (!col) {
        return undefined;
      }
      const left = INDEX_WIDTH + col.left - applied.x;
      if (x >= left + col.width - RESIZE_HIT) {
        return { kind: "col-resize", ri: -1, ci: col.ci, index: col.ci };
      }
      return { kind: "col-header", ri: -1, ci: col.ci };
    }
    if (x < INDEX_WIDTH) {
      const row = sheet.findRowAt(applied.y + y - HEADER_HEIGHT);
      if (!row) {
        return undefined;
      }
      const top = HEADER_HEIGHT + row.top - applied.y;
      if (y >= top + row.height - RESIZE_HIT) {
        return { kind: "row-resize", ri: row.ri, ci: -1, index: row.ri };
      }
      return { kind: "row-header", ri: row.ri, ci: -1 };
    }
    const col = sheet.findColAt(applied.x + x - INDEX_WIDTH);
    const row = sheet.findRowAt(applied.y + y - HEADER_HEIGHT);
    if (!col || !row) {
      return undefined;
    }
    const origin = sheet.mergeOrigin(row.ri, col.ci);
    if (sheet.autoFilter.includes(origin.ri, origin.ci)) {
      const left = INDEX_WIDTH + col.left - applied.x;
      const top = HEADER_HEIGHT + row.top - applied.y;
      if (x >= left + col.width - FILTER_HIT && y >= top + row.height - FILTER_HIT) {
        return { kind: "filter-button", ri: origin.ri, ci: origin.ci };
      }
    }
    return { kind: "cell", ri: origin.ri, ci: origin.ci };
  }
}
