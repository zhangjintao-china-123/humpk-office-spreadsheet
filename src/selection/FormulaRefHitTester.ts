import type { FormulaRef } from "../formula/formulaRefs";
import type { ImageHandle } from "../model/SheetImage";
import type { Sheet } from "../model/Sheet";
import { appliedScroll } from "../render/FreezePane";
import { HEADER_HEIGHT, INDEX_WIDTH } from "../shared/constants";
import { handleBox, IMAGE_CURSORS } from "./ImageHitTester";

const HANDLES: ImageHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export type FormulaRefHit = {
  index: number;
  handle: ImageHandle;
};

export const FORMULA_REF_CURSORS = IMAGE_CURSORS;

export class FormulaRefHitTester {
  hit(
    sheet: Sheet,
    refs: FormulaRef[],
    x: number,
    y: number,
    scrollX: number,
    scrollY: number,
  ): FormulaRefHit | undefined {
    if (x < INDEX_WIDTH || y < HEADER_HEIGHT) {
      return undefined;
    }
    for (let i = refs.length - 1; i >= 0; i -= 1) {
      const ref = refs[i];
      const rect = refScreenRect(sheet, ref, scrollX, scrollY);
      for (const handle of HANDLES) {
        const box = handleBox(rect, handle);
        if (x >= box.x && x <= box.x + box.size && y >= box.y && y <= box.y + box.size) {
          return { index: i, handle };
        }
      }
    }
    return undefined;
  }
}

export function refScreenRect(
  sheet: Sheet,
  ref: FormulaRef,
  scrollX: number,
  scrollY: number,
): { x: number; y: number; width: number; height: number } {
  const { range } = ref;
  const contentX = sheet.colLeft(range.sci);
  const contentY = sheet.rowTop(range.sri);
  const applied = appliedScroll(sheet, contentX, contentY, scrollX, scrollY);
  let width = 0;
  let height = 0;
  for (let ci = range.sci; ci <= range.eci; ci += 1) {
    width += sheet.cols.getWidth(ci);
  }
  for (let ri = range.sri; ri <= range.eri; ri += 1) {
    if (!sheet.isRowHidden(ri)) {
      height += sheet.rows.getHeight(ri);
    }
  }
  return {
    x: INDEX_WIDTH + contentX - applied.x,
    y: HEADER_HEIGHT + contentY - applied.y,
    width,
    height,
  };
}
