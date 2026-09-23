import type ExcelJS from "exceljs";
import {
  cloneMark,
  parsePriorityMark,
  parseShapeMark,
  parseVerdictMark,
  type CellMark,
} from "../../model/CellMarks";
import type { Workbook } from "../../model/Workbook";
import { expr2xy, xy2expr } from "../../shared/alphabet";

export const CELL_MARKS_SHEET = "__so_cell_marks";

export type PersistedCellMark = {
  sheetName: string;
  ref: string;
  mark: CellMark;
};

export function isCellMarksSheet(name?: string): boolean {
  return (name ?? "").trim() === CELL_MARKS_SHEET;
}

export function readCellMarks(excel: ExcelJS.Workbook): PersistedCellMark[] {
  const sheet =
    excel.worksheets.find((item) => isCellMarksSheet(item.name))
    ?? excel.getWorksheet(CELL_MARKS_SHEET);
  if (!sheet) {
    return [];
  }
  const items: PersistedCellMark[] = [];
  const seen = new Set<string>();
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const sheetName = String(row.getCell(1).value ?? "").trim();
    const ref = String(row.getCell(2).value ?? "").trim().toUpperCase();
    const mark = cloneMark({
      priority: parsePriorityMark(row.getCell(3).value),
      shape: parseShapeMark(row.getCell(4).value),
      verdict: parseVerdictMark(row.getCell(5).value),
    });
    if (!sheetName || !ref || !mark || isCellMarksSheet(sheetName)) {
      return;
    }
    const key = `${sheetName}\u0001${ref}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    items.push({ sheetName, ref, mark });
  });
  return items;
}

export function writeCellMarks(excel: ExcelJS.Workbook, book: Workbook): void {
  const items: PersistedCellMark[] = [];
  const seen = new Set<string>();
  for (const sheet of book.sheets) {
    if (isCellMarksSheet(sheet.name)) {
      continue;
    }
    for (const cell of sheet.listCellMarks()) {
      const ref = xy2expr(cell.ci, cell.ri);
      const key = `${sheet.name}\u0001${ref}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({ sheetName: sheet.name, ref, mark: cell.mark });
    }
  }
  const previous = excel.worksheets.find((item) => isCellMarksSheet(item.name));
  if (previous) {
    excel.removeWorksheet(previous.id);
  }
  if (!items.length) {
    return;
  }
  const hidden = excel.addWorksheet(CELL_MARKS_SHEET, { state: "hidden" });
  hidden.state = "hidden";
  hidden.getCell(1, 1).value = "sheet";
  hidden.getCell(1, 2).value = "ref";
  hidden.getCell(1, 3).value = "priority";
  hidden.getCell(1, 4).value = "shape";
  hidden.getCell(1, 5).value = "verdict";
  items.forEach((item, index) => {
    hidden.getCell(index + 2, 1).value = item.sheetName;
    hidden.getCell(index + 2, 2).value = item.ref;
    if (item.mark.priority) {
      hidden.getCell(index + 2, 3).value = item.mark.priority;
    }
    if (item.mark.shape) {
      hidden.getCell(index + 2, 4).value = item.mark.shape;
    }
    if (item.mark.verdict) {
      hidden.getCell(index + 2, 5).value = item.mark.verdict;
    }
  });
}

export function applyCellMarksToWorkbook(book: Workbook, items: PersistedCellMark[]): void {
  const bySheet = new Map<string, Array<{ ri: number; ci: number; mark: CellMark }>>();
  for (const item of items) {
    const sheetName = item.sheetName.trim();
    const ref = item.ref.trim().toUpperCase();
    const mark = cloneMark(item.mark);
    if (!sheetName || !ref || !mark) {
      continue;
    }
    const [ci, ri] = expr2xy(ref);
    if (ri < 0 || ci < 0 || !Number.isFinite(ri) || !Number.isFinite(ci)) {
      continue;
    }
    const list = bySheet.get(sheetName) ?? [];
    list.push({ ri, ci, mark });
    bySheet.set(sheetName, list);
  }
  const visible = book.sheets.filter((sheet) => !isCellMarksSheet(sheet.name));
  for (const sheet of visible) {
    const wanted = sheet.name.trim();
    const cells =
      bySheet.get(sheet.name)
      ?? bySheet.get(wanted)
      ?? [...bySheet.entries()].find(([name]) => name.trim() === wanted)?.[1]
      ?? [];
    sheet.setCellMarks(cells);
  }
}
