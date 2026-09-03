import { CellRange } from "../model/CellRange";
import type { Sheet } from "../model/Sheet";
import { MAX_PRINT_PAGES, type PrintSetup } from "./PrintSetup";
import type { PrintPage } from "./PrintPage";

export function paginateSheet(sheet: Sheet, setup: PrintSetup): PrintPage[] {
  const used = sheet.usedRange() ?? CellRange.cell(0, 0);
  const bands = columnBands(sheet, used.sci, used.eci, setup.cellSpaceWidth);
  const pages: PrintPage[] = [];
  for (const band of bands) {
    let next = used.sri;
    while (next <= used.eri && pages.length < MAX_PRINT_PAGES) {
      const rowPage = nextRowPage(sheet, next, used.eri, setup.cellSpaceHeight);
      if (!rowPage) {
        break;
      }
      pages.push({
        sri: rowPage.sri,
        sci: band.sci,
        eri: rowPage.eri,
        eci: band.eci,
        scrollX: sheet.colLeft(band.sci),
        scrollY: sheet.rowTop(rowPage.sri),
      });
      next = rowPage.eri + 1;
    }
  }
  return pages.length ? pages : [{
    sri: 0,
    sci: 0,
    eri: 0,
    eci: 0,
    scrollX: 0,
    scrollY: 0,
  }];
}

export function columnBands(
  sheet: Sheet,
  sci: number,
  eci: number,
  maxWidth: number,
): Array<{ sci: number; eci: number }> {
  const bands: Array<{ sci: number; eci: number }> = [];
  let start = sci;
  let width = 0;
  for (let ci = sci; ci <= eci; ci += 1) {
    const colW = sheet.cols.getWidth(ci);
    if (width > 0 && width + colW > maxWidth) {
      bands.push({ sci: start, eci: ci - 1 });
      start = ci;
      width = 0;
    }
    if (width === 0 && colW >= maxWidth) {
      bands.push({ sci: ci, eci: ci });
      start = ci + 1;
      continue;
    }
    width += colW;
  }
  if (start <= eci) {
    bands.push({ sci: start, eci });
  }
  return bands;
}

function nextRowPage(
  sheet: Sheet,
  start: number,
  last: number,
  maxHeight: number,
): { sri: number; eri: number } | undefined {
  let sri: number | undefined;
  let eri = start;
  let height = 0;
  for (const ri of sheet.eachViewRow()) {
    if (ri < start) {
      continue;
    }
    if (ri > last) {
      break;
    }
    const rowH = sheet.rows.getHeight(ri);
    if (sri === undefined) {
      sri = ri;
    }
    if (height > 0 && height + rowH > maxHeight) {
      break;
    }
    height += rowH;
    eri = ri;
    if (rowH >= maxHeight) {
      break;
    }
  }
  return sri === undefined ? undefined : { sri, eri };
}
