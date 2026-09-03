import type { Sheet } from "../model/Sheet";
import { FREEZE_LINE, HEADER_HEIGHT, INDEX_WIDTH } from "../shared/constants";
import type { Draw } from "./Draw";

export interface PaintPane {
  scrollX: number;
  scrollY: number;
  clipX: number;
  clipY: number;
  clipW: number;
  clipH: number;
}

export function paintPanes(sheet: Sheet, scrollX: number, scrollY: number, viewW: number, viewH: number): PaintPane[] {
  const fsw = sheet.freezeTotalWidth();
  const fsh = sheet.freezeTotalHeight();
  const [fri, fci] = sheet.freeze;
  const panes: PaintPane[] = [
    {
      scrollX,
      scrollY,
      clipX: INDEX_WIDTH + fsw,
      clipY: HEADER_HEIGHT + fsh,
      clipW: Math.max(0, viewW - fsw),
      clipH: Math.max(0, viewH - fsh),
    },
  ];
  if (fri > 0) {
    panes.push({
      scrollX,
      scrollY: 0,
      clipX: INDEX_WIDTH + fsw,
      clipY: HEADER_HEIGHT,
      clipW: Math.max(0, viewW - fsw),
      clipH: fsh,
    });
  }
  if (fci > 0) {
    panes.push({
      scrollX: 0,
      scrollY,
      clipX: INDEX_WIDTH,
      clipY: HEADER_HEIGHT + fsh,
      clipW: fsw,
      clipH: Math.max(0, viewH - fsh),
    });
  }
  if (fri > 0 && fci > 0) {
    panes.push({
      scrollX: 0,
      scrollY: 0,
      clipX: INDEX_WIDTH,
      clipY: HEADER_HEIGHT,
      clipW: fsw,
      clipH: fsh,
    });
  }
  return panes.filter((pane) => pane.clipW > 0 && pane.clipH > 0);
}

export function paneContentOrigin(pane: PaintPane): { x: number; y: number } {
  return {
    x: pane.clipX - INDEX_WIDTH + pane.scrollX,
    y: pane.clipY - HEADER_HEIGHT + pane.scrollY,
  };
}

export function appliedScroll(
  sheet: Sheet,
  contentX: number,
  contentY: number,
  scrollX: number,
  scrollY: number,
): { x: number; y: number } {
  const fsw = sheet.freezeTotalWidth();
  const fsh = sheet.freezeTotalHeight();
  return {
    x: fsw > 0 && contentX < fsw ? 0 : scrollX,
    y: fsh > 0 && contentY < fsh ? 0 : scrollY,
  };
}

export function cellScreenXY(
  sheet: Sheet,
  contentX: number,
  contentY: number,
  scrollX: number,
  scrollY: number,
): { x: number; y: number } {
  const scroll = appliedScroll(sheet, contentX, contentY, scrollX, scrollY);
  return {
    x: INDEX_WIDTH + contentX - scroll.x,
    y: HEADER_HEIGHT + contentY - scroll.y,
  };
}

export function hitAppliedScroll(
  sheet: Sheet,
  x: number,
  y: number,
  scrollX: number,
  scrollY: number,
): { x: number; y: number } {
  const fsw = sheet.freezeTotalWidth();
  const fsh = sheet.freezeTotalHeight();
  return {
    x: x < INDEX_WIDTH + fsw ? 0 : scrollX,
    y: y < HEADER_HEIGHT + fsh ? 0 : scrollY,
  };
}

export function paintFreezeLines(draw: Draw, sheet: Sheet, w: number, h: number): void {
  const fsw = sheet.freezeTotalWidth();
  const fsh = sheet.freezeTotalHeight();
  if (fsh > 0) {
    draw.line(INDEX_WIDTH, HEADER_HEIGHT + fsh, w, HEADER_HEIGHT + fsh, FREEZE_LINE);
  }
  if (fsw > 0) {
    draw.line(INDEX_WIDTH + fsw, HEADER_HEIGHT, INDEX_WIDTH + fsw, h, FREEZE_LINE);
  }
}
