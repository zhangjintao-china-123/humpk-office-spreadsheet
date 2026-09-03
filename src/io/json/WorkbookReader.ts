import { cloneStyle, type CellStyle } from "../../model/CellStyle";
import { Sheet } from "../../model/Sheet";
import type { SheetJson } from "../../model/SheetJson";
import { Workbook } from "../../model/Workbook";
import { expr2xy } from "../../shared/alphabet";

export class WorkbookReader {
  read(input: unknown): Workbook {
    const list = normalize(input);
    const book = new Workbook();
    if (list.length === 0) {
      book.sheets.push(new Sheet("Sheet1"));
      return book;
    }
    book.sheets = list.map((item) => this.readSheet(item));
    book.activeIndex = 0;
    return book;
  }

  readSheet(json: SheetJson): Sheet {
    const sheet = new Sheet(json.name || "Sheet1");
    sheet.styles = (json.styles ?? []).map((style) => cloneStyle(style as CellStyle));
    sheet.merges.setData(json.merges);
    sheet.cols.setData(json.cols);
    sheet.rows.setData(json.rows);
    sheet.images.setData(json.uploadimages);
    sheet.autoFilter.setData(json.autofilter);
    if (typeof json.freeze === "string" && json.freeze) {
      const [ci, ri] = expr2xy(json.freeze);
      sheet.setFreeze(ri, ci);
    }
    sheet.refreshFilterView();
    return sheet;
  }
}

function normalize(input: unknown): SheetJson[] {
  if (Array.isArray(input)) {
    return input.filter(isSheetJson);
  }
  if (isSheetJson(input)) {
    return [input];
  }
  return [];
}

function isSheetJson(value: unknown): value is SheetJson {
  return !!value && typeof value === "object" && "name" in value;
}
