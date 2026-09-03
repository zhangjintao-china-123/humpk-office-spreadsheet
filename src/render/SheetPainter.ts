import { cellDisplay } from "../model/Cell";
import { CellRange } from "../model/CellRange";
import { DEFAULT_STYLE, styleFontCss, type CellStyle } from "../model/CellStyle";
import type { Sheet } from "../model/Sheet";
import type { Selection } from "../selection/Selection";
import {
  CELL_PAD,
  CLIPBOARD_DASH,
  GRID_COLOR,
  HEADER_ACTIVE_BG,
  HEADER_BG,
  HEADER_BORDER,
  HEADER_HEIGHT,
  HEADER_TEXT,
  INDEX_WIDTH,
  SELECTION_FILL,
  SELECTION_STROKE,
} from "../shared/constants";
import type { Draw } from "./Draw";
import { paintFreezeLines, paintPanes, paneContentOrigin, type PaintPane } from "./FreezePane";
import { ImagePainter } from "./ImagePainter";
import { paintCellBorders } from "./BorderStroke";
import { paintableBorder } from "./MergeBorder";
import { hidesHGrid, hidesVGrid } from "./MergeGrid";

export class SheetPainter {
  private readonly images = new ImagePainter();

  paint(draw: Draw, sheet: Sheet, selection: Selection, scrollX: number, scrollY: number, selectedImageId?: number, clipboard?: CellRange): void {
    const { cssWidth: w, cssHeight: h } = draw;
    draw.clear();
    draw.fillRect(0, 0, w, h, "#ffffff");
    const viewW = w - INDEX_WIDTH;
    const viewH = h - HEADER_HEIGHT;
    const panes = paintPanes(sheet, scrollX, scrollY, viewW, viewH);
    this.paintHeaders(draw, sheet, selection, scrollX, scrollY, w, h);
    for (const pane of panes) {
      const origin = paneContentOrigin(pane);
      const visible = sheet.visibleRange(origin.x, origin.y, pane.clipW, pane.clipH);
      const rows = sheet.visibleRowsInView(origin.y, pane.clipH);
      this.paintGrid(draw, sheet, visible, rows, pane);
      this.paintCells(draw, sheet, visible, rows, pane);
    }
    for (const pane of panes) {
      this.images.paint(draw, sheet, pane.scrollX, pane.scrollY, selectedImageId, pane);
    }
    if (selectedImageId === undefined) {
      for (const pane of panes) {
        this.paintSelection(draw, sheet, selection, pane, clipboard);
      }
    }
    if (clipboard) {
      for (const pane of panes) {
        this.paintClipboard(draw, sheet, clipboard, pane);
      }
    }
    for (const pane of panes) {
      this.paintFilterButtons(draw, sheet, pane);
    }
    paintFreezeLines(draw, sheet, w, h);
  }

  private paintGrid(
    draw: Draw,
    sheet: Sheet,
    visible: CellRange,
    rows: Array<{ ri: number; top: number; height: number }>,
    pane: PaintPane,
  ): void {
    draw.save();
    draw.clipRect(pane.clipX, pane.clipY, pane.clipW, pane.clipH);
    for (const row of rows) {
      const y = HEADER_HEIGHT + row.top - pane.scrollY;
      paintHGrid(draw, sheet, visible, row.ri, y, pane.scrollX, "top");
      paintHGrid(draw, sheet, visible, row.ri, y + row.height, pane.scrollX, "bottom");
    }
    for (let ci = visible.sci; ci <= visible.eci + 1 && ci <= sheet.cols.len; ci += 1) {
      const x = INDEX_WIDTH + sheet.colLeft(ci) - pane.scrollX;
      paintVGrid(draw, sheet, rows, ci, x, pane.scrollY);
    }
    draw.restore();
  }

  private paintCells(
    draw: Draw,
    sheet: Sheet,
    visible: CellRange,
    rows: Array<{ ri: number; top: number; height: number }>,
    pane: PaintPane,
  ): void {
    draw.save();
    draw.clipRect(pane.clipX - 1, pane.clipY - 1, pane.clipW + 2, pane.clipH + 2);
    const painted = new Set<string>();
    for (const row of rows) {
      for (let ci = visible.sci; ci <= visible.eci; ci += 1) {
        const origin = sheet.mergeOrigin(row.ri, ci);
        const key = `${origin.ri},${origin.ci}`;
        if (painted.has(key)) {
          continue;
        }
        painted.add(key);
        const box = sheet.cellBox(origin.ri, origin.ci);
        const x = INDEX_WIDTH + box.x - pane.scrollX;
        const y = HEADER_HEIGHT + sheet.rowTop(origin.ri) - pane.scrollY;
        if (x > pane.clipX + pane.clipW || y > pane.clipY + pane.clipH
          || x + box.width < pane.clipX || y + box.height < pane.clipY) {
          continue;
        }
        const cell = sheet.getCell(origin.ri, origin.ci);
        const style = sheet.getCellStyle(origin.ri, origin.ci);
        const merge = sheet.merges.getFirstIncludes(origin.ri, origin.ci);
        const fill = style.bgcolor && style.bgcolor !== DEFAULT_STYLE.bgcolor
          ? style.bgcolor
          : merge?.multiple()
            ? "#ffffff"
            : undefined;
        if (fill) {
          draw.fillRect(x + 1, y + 1, Math.max(0, box.width - 2), Math.max(0, box.height - 2), fill);
        }
        paintCellBorders(draw, x, y, box.width, box.height, paintableBorder(sheet, origin.ri, origin.ci));
        const text = cellDisplay(cell);
        if (text) {
          this.paintText(draw, text, x, y, box.width, box.height, style);
        }
      }
    }
    draw.restore();
  }

  private paintText(draw: Draw, text: string, x: number, y: number, width: number, height: number, style: CellStyle): void {
    draw.save();
    draw.clipRect(x + 1, y + 1, width - 2, height - 2);
    draw.setFont(styleFontCss(style));
    const align = style.align ?? "left";
    const valign = style.valign ?? "middle";
    const tx = align === "center" ? x + width / 2 : align === "right" ? x + width - CELL_PAD : x + CELL_PAD;
    const ty = valign === "top" ? y + CELL_PAD : valign === "bottom" ? y + height - CELL_PAD : y + height / 2;
    const baseline: CanvasTextBaseline = valign === "top" ? "top" : valign === "bottom" ? "bottom" : "middle";
    const color = style.color ?? DEFAULT_STYLE.color;
    if (style.textwrap) {
      const lines = wrapLines(draw, text, width - CELL_PAD * 2);
      const lineH = (style.font?.size ?? 10) * (96 / 72) + 2;
      let startY = ty;
      if (valign === "middle") {
        startY = y + height / 2 - ((lines.length - 1) * lineH) / 2;
      } else if (valign === "bottom") {
        startY = y + height - CELL_PAD - (lines.length - 1) * lineH;
      }
      lines.forEach((line, i) => {
        draw.fillText(line, tx, startY + i * lineH, color, align, baseline);
      });
    } else {
      draw.fillText(text, tx, ty, color, align, baseline);
    }
    if (style.underline || style.strike) {
      const tw = draw.measureText(text);
      const left = align === "center" ? tx - tw / 2 : align === "right" ? tx - tw : tx;
      if (style.underline) {
        const uy = valign === "top" ? ty + 12 : valign === "bottom" ? ty - 2 : ty + 6;
        draw.line(left, uy, left + tw, uy, color);
      }
      if (style.strike) {
        const sy = valign === "top" ? ty + 6 : valign === "bottom" ? ty - 6 : ty;
        draw.line(left, sy, left + tw, sy, color);
      }
    }
    draw.restore();
  }

  private paintSelection(
    draw: Draw,
    sheet: Sheet,
    selection: Selection,
    pane: PaintPane,
    clipboard?: CellRange,
  ): void {
    const box = rangeScreenBox(sheet, selection.range, pane);
    draw.save();
    draw.clipRect(pane.clipX, pane.clipY, pane.clipW, pane.clipH);
    draw.fillRect(box.x, box.y, box.width, box.height, SELECTION_FILL);
    if (!sameRange(selection.range, clipboard)) {
      draw.strokeRect(box.x, box.y, box.width, box.height, SELECTION_STROKE, 2);
    }
    draw.restore();
  }

  private paintClipboard(
    draw: Draw,
    sheet: Sheet,
    range: CellRange,
    pane: PaintPane,
  ): void {
    const box = rangeScreenBox(sheet, range, pane);
    draw.save();
    draw.clipRect(pane.clipX, pane.clipY, pane.clipW, pane.clipH);
    draw.strokeRect(box.x, box.y, box.width, box.height, SELECTION_STROKE, 2, CLIPBOARD_DASH);
    draw.restore();
  }

  private paintHeaders(
    draw: Draw,
    sheet: Sheet,
    selection: Selection,
    scrollX: number,
    scrollY: number,
    w: number,
    h: number,
  ): void {
    const viewW = w - INDEX_WIDTH;
    const viewH = h - HEADER_HEIGHT;
    const fsw = sheet.freezeTotalWidth();
    const fsh = sheet.freezeTotalHeight();
    const [fri, fci] = sheet.freeze;
    draw.fillRect(0, 0, w, HEADER_HEIGHT, HEADER_BG);
    draw.fillRect(0, 0, INDEX_WIDTH, h, HEADER_BG);
    draw.line(0, HEADER_HEIGHT, w, HEADER_HEIGHT, HEADER_BORDER);
    draw.line(INDEX_WIDTH, 0, INDEX_WIDTH, h, HEADER_BORDER);
    draw.setFont("12px Arial");
    if (fci > 0) {
      draw.save();
      draw.clipRect(INDEX_WIDTH, 0, fsw, HEADER_HEIGHT);
      paintColHeaders(draw, sheet, selection, 0, fci - 1, 0);
      draw.restore();
    }
    draw.save();
    draw.clipRect(INDEX_WIDTH + fsw, 0, Math.max(0, viewW - fsw), HEADER_HEIGHT);
    const startCol = sheet.findColAt(scrollX + fsw);
    const endCol = sheet.findColAt(scrollX + viewW) ?? { ci: sheet.cols.len - 1 };
    paintColHeaders(draw, sheet, selection, startCol?.ci ?? fci, endCol.ci, scrollX);
    draw.restore();
    if (fri > 0) {
      draw.save();
      draw.clipRect(0, HEADER_HEIGHT, INDEX_WIDTH, fsh);
      paintRowHeaders(draw, sheet, selection, sheet.visibleRowsInView(0, fsh), 0);
      draw.restore();
    }
    draw.save();
    draw.clipRect(0, HEADER_HEIGHT + fsh, INDEX_WIDTH, Math.max(0, viewH - fsh));
    paintRowHeaders(draw, sheet, selection, sheet.visibleRowsInView(scrollY + fsh, viewH - fsh), scrollY);
    draw.restore();
    draw.fillRect(0, 0, INDEX_WIDTH, HEADER_HEIGHT, HEADER_BG);
    draw.strokeRect(0, 0, INDEX_WIDTH, HEADER_HEIGHT, HEADER_BORDER);
  }

  private paintFilterButtons(draw: Draw, sheet: Sheet, pane: PaintPane): void {
    if (!sheet.autoFilter.active()) {
      return;
    }
    const header = sheet.autoFilter.hrange();
    draw.save();
    draw.clipRect(pane.clipX, pane.clipY, pane.clipW, pane.clipH);
    for (let ci = header.sci; ci <= header.eci; ci += 1) {
      const box = sheet.cellBox(header.sri, ci);
      const x = INDEX_WIDTH + box.x - pane.scrollX;
      const y = HEADER_HEIGHT + box.y - pane.scrollY;
      if (x > pane.clipX + pane.clipW || y > pane.clipY + pane.clipH
        || x + box.width < pane.clipX || y + box.height < pane.clipY) {
        continue;
      }
      const marked = !!sheet.autoFilter.getSort(ci) || !!sheet.autoFilter.getFilter(ci);
      draw.dropdown(x, y, box.width, box.height, marked);
    }
    draw.restore();
  }
}

function paintColHeaders(
  draw: Draw,
  sheet: Sheet,
  selection: Selection,
  sci: number,
  eci: number,
  scrollX: number,
): void {
  for (let ci = sci; ci <= eci; ci += 1) {
    const x = INDEX_WIDTH + sheet.colLeft(ci) - scrollX;
    const width = sheet.cols.getWidth(ci);
    const active = selection.range.sci <= ci && ci <= selection.range.eci;
    if (active) {
      draw.fillRect(x, 0, width, HEADER_HEIGHT, HEADER_ACTIVE_BG);
    }
    draw.line(x + width, 0, x + width, HEADER_HEIGHT, HEADER_BORDER);
    draw.fillText(colLabel(ci), x + width / 2, HEADER_HEIGHT / 2, HEADER_TEXT, "center", "middle");
  }
}

function paintRowHeaders(
  draw: Draw,
  _sheet: Sheet,
  selection: Selection,
  rows: Array<{ ri: number; top: number; height: number }>,
  scrollY: number,
): void {
  for (const row of rows) {
    const y = HEADER_HEIGHT + row.top - scrollY;
    const active = selection.range.sri <= row.ri && row.ri <= selection.range.eri;
    if (active) {
      draw.fillRect(0, y, INDEX_WIDTH, row.height, HEADER_ACTIVE_BG);
    }
    draw.line(0, y + row.height, INDEX_WIDTH, y + row.height, HEADER_BORDER);
    draw.fillText(String(row.ri + 1), INDEX_WIDTH / 2, y + row.height / 2, HEADER_TEXT, "center", "middle");
  }
}

function paintHGrid(
  draw: Draw,
  sheet: Sheet,
  visible: CellRange,
  ri: number,
  y: number,
  scrollX: number,
  edge: "top" | "bottom",
): void {
  let start: number | undefined;
  const flush = (end: number): void => {
    if (start !== undefined && end > start) {
      draw.line(start, y, end, y, GRID_COLOR);
    }
    start = undefined;
  };
  for (let ci = visible.sci; ci <= visible.eci; ci += 1) {
    const x = INDEX_WIDTH + sheet.colLeft(ci) - scrollX;
    const width = sheet.cols.getWidth(ci);
    if (hidesHGrid(sheet, ri, ci, edge)) {
      flush(x);
    } else if (start === undefined) {
      start = x;
    }
    if (ci === visible.eci) {
      flush(hidesHGrid(sheet, ri, ci, edge) ? x : x + width);
    }
  }
}

function paintVGrid(
  draw: Draw,
  sheet: Sheet,
  rows: Array<{ ri: number; top: number; height: number }>,
  boundaryCi: number,
  x: number,
  scrollY: number,
): void {
  let start: number | undefined;
  const flush = (end: number): void => {
    if (start !== undefined && end > start) {
      draw.line(x, start, x, end, GRID_COLOR);
    }
    start = undefined;
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const y = HEADER_HEIGHT + row.top - scrollY;
    if (hidesVGrid(sheet, row.ri, boundaryCi)) {
      flush(y);
    } else if (start === undefined) {
      start = y;
    }
    if (i === rows.length - 1) {
      flush(hidesVGrid(sheet, row.ri, boundaryCi) ? y : y + row.height);
    }
  }
}

function colLabel(ci: number): string {
  let n = ci + 1;
  let text = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    text = String.fromCharCode(65 + rem) + text;
    n = Math.floor((n - 1) / 26);
  }
  return text;
}

function sameRange(a: CellRange, b?: CellRange): boolean {
  return !!b && a.sri === b.sri && a.sci === b.sci && a.eri === b.eri && a.eci === b.eci;
}

export function rangeScreenBox(
  sheet: Sheet,
  range: CellRange,
  pane: PaintPane,
): { x: number; y: number; width: number; height: number } {
  const x = INDEX_WIDTH + sheet.colLeft(range.sci) - pane.scrollX;
  const y = HEADER_HEIGHT + sheet.rowTop(range.sri) - pane.scrollY;
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
  return { x, y, width, height };
}

function wrapLines(draw: Draw, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const ch of paragraph) {
      const next = current + ch;
      if (current && draw.measureText(next) > maxWidth) {
        lines.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [""];
}
