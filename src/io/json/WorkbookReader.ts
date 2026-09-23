import { parseCellControl } from "../../model/CellControl";
import { cloneMark, parsePriorityMark, parseShapeMark, parseVerdictMark } from "../../model/CellMarks";
import { cloneStyle, type CellStyle } from "../../model/CellStyle";
import { Sheet } from "../../model/Sheet";
import type { SheetJson } from "../../model/SheetJson";
import { Workbook } from "../../model/Workbook";
import { expr2xy } from "../../shared/alphabet";
import { isCellMarksSheet } from "../xlsx/cellMarks";
import { isCheckmarksSheet } from "../xlsx/checkmarks";
import { isEditablesSheet } from "../xlsx/editables";

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
    sheet.table = json.table;
    sheet.filters = json.filters;
    sheet.styles = (json.styles ?? []).map((style) => cloneStyle(style as CellStyle));
    sheet.merges.setData(json.merges);
    sheet.cols.setData(json.cols);
    sheet.rows.setData(json.rows);
    sheet.images.setData(json.uploadimages);
    sheet.autoFilter.setData(json.autofilter);
    sheet.alignAutoFilterHeader();
    if (typeof json.freeze === "string" && json.freeze) {
      const [ci, ri] = expr2xy(json.freeze);
      sheet.setFreeze(ri, ci);
    }
    if (Array.isArray(json.cellMarks)) {
      sheet.setCellMarks(
        json.cellMarks.flatMap((item) => {
          if (!item || typeof item.ref !== "string" || !item.ref.trim()) return [];
          const [ci, ri] = expr2xy(item.ref);
          const mark = cloneMark({
            priority: parsePriorityMark(item.priority),
            shape: parseShapeMark(item.shape),
            verdict: parseVerdictMark(item.verdict),
          });
          return ri >= 0 && ci >= 0 && mark ? [{ ri, ci, mark }] : [];
        }),
      );
    }
    if (Array.isArray(json.checkmarks)) {
      sheet.setCheckmarks(
        json.checkmarks.flatMap((ref) => {
          if (typeof ref !== "string" || !ref.trim()) return [];
          const [ci, ri] = expr2xy(ref);
          return ri >= 0 && ci >= 0 ? [{ ri, ci }] : [];
        }),
      );
    }
    if (Array.isArray(json.editables)) {
      sheet.setEditableCells(
        json.editables.flatMap((ref) => {
          if (typeof ref !== "string" || !ref.trim()) return [];
          const [ci, ri] = expr2xy(ref);
          return ri >= 0 && ci >= 0 ? [{ ri, ci }] : [];
        }),
      );
    }
    if (Array.isArray(json.cellControls)) {
      sheet.setCellControls(
        json.cellControls.flatMap((item) => {
          if (!item || typeof item.ref !== "string" || !item.ref.trim()) return [];
          const [ci, ri] = expr2xy(item.ref);
          const control = parseCellControl(item.kind, item.options ?? []);
          return ri >= 0 && ci >= 0 && control ? [{ ri, ci, control }] : [];
        }),
      );
    }
    sheet.refreshFilterView();
    return sheet;
  }
}

function normalize(input: unknown): SheetJson[] {
  if (Array.isArray(input)) {
    return input.filter(isSheetJson).filter((item) => !isCheckmarksSheet(item.name) && !isEditablesSheet(item.name) && !isCellMarksSheet(item.name));
  }
  if (isSheetJson(input)) {
    return [input];
  }
  return [];
}

function isSheetJson(value: unknown): value is SheetJson {
  return !!value && typeof value === "object" && "name" in value;
}
