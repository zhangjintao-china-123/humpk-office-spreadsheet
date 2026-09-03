import { cellDisplay } from "../model/Cell";
import { CellRange } from "../model/CellRange";
import { DEFAULT_STYLE, styleFontCss, type CellStyle } from "../model/CellStyle";
import type { Sheet } from "../model/Sheet";
import { imageRect } from "../model/SheetImage";
import type { Draw } from "../render/Draw";
import { imageCache } from "../render/image/ImageCache";
import { paintCellBorders } from "../render/BorderStroke";
import { paintableBorder } from "../render/MergeBorder";
import { hidesHGrid, hidesVGrid } from "../render/MergeGrid";
import { CELL_PAD, GRID_COLOR, HEADER_HEIGHT, INDEX_WIDTH } from "../shared/constants";
import type { PrintPage } from "./PrintPage";
import type { PrintSetup } from "./PrintSetup";

export class PrintPainter {
  paint(draw: Draw, sheet: Sheet, page: PrintPage, setup: PrintSetup): void {
    draw.clear();
    draw.fillRect(0, 0, setup.cssWidth, setup.cssHeight, "#ffffff");
    draw.save();
    draw.translate(setup.marginX, setup.marginY);
    draw.scale(setup.scale, setup.scale);
    draw.clipRect(0, 0, setup.cellSpaceWidth, setup.cellSpaceHeight);
    const visible = new CellRange(page.sri, page.sci, page.eri, page.eci);
    const rows = pageRows(sheet, page);
    paintGrid(draw, sheet, visible, rows, page);
    paintCells(draw, sheet, visible, rows, page);
    paintImages(draw, sheet, page, setup);
    draw.restore();
  }
}

function pageRows(sheet: Sheet, page: PrintPage): Array<{ ri: number; top: number; height: number }> {
  const rows: Array<{ ri: number; top: number; height: number }> = [];
  for (const ri of sheet.eachViewRow()) {
    if (ri < page.sri) {
      continue;
    }
    if (ri > page.eri) {
      break;
    }
    rows.push({ ri, top: sheet.rowTop(ri), height: sheet.rows.getHeight(ri) });
  }
  return rows;
}

function paintGrid(
  draw: Draw,
  sheet: Sheet,
  visible: CellRange,
  rows: Array<{ ri: number; top: number; height: number }>,
  page: PrintPage,
): void {
  for (const row of rows) {
    const y = row.top - page.scrollY;
    paintHGrid(draw, sheet, visible, row.ri, y, page.scrollX, "top");
    paintHGrid(draw, sheet, visible, row.ri, y + row.height, page.scrollX, "bottom");
  }
  for (let ci = visible.sci; ci <= visible.eci + 1 && ci <= sheet.cols.len; ci += 1) {
    const x = sheet.colLeft(ci) - page.scrollX;
    paintVGrid(draw, sheet, rows, ci, x, page.scrollY);
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
    const x = sheet.colLeft(ci) - scrollX;
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
    const y = row.top - scrollY;
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

function paintCells(
  draw: Draw,
  sheet: Sheet,
  visible: CellRange,
  rows: Array<{ ri: number; top: number; height: number }>,
  page: PrintPage,
): void {
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
      const x = box.x - page.scrollX;
      const y = sheet.rowTop(origin.ri) - page.scrollY;
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
        paintText(draw, text, x, y, box.width, box.height, style);
      }
    }
  }
}

function paintText(draw: Draw, text: string, x: number, y: number, width: number, height: number, style: CellStyle): void {
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
  draw.restore();
}

function paintImages(draw: Draw, sheet: Sheet, page: PrintPage, setup: PrintSetup): void {
  for (const image of sheet.images.list()) {
    const rect = imageRect(image);
    const x = rect.x - INDEX_WIDTH - page.scrollX;
    const y = rect.y - HEADER_HEIGHT - page.scrollY;
    if (x > setup.cellSpaceWidth || y > setup.cellSpaceHeight || x + rect.width < 0 || y + rect.height < 0) {
      continue;
    }
    const ready = imageCache.ensure(image.url);
    if (ready) {
      draw.drawImage(ready, x, y, rect.width, rect.height);
    }
  }
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
