import type ExcelJS from "exceljs";
import type { Workbook } from "../../model/Workbook";
import {
  decodeControlOptions,
  encodeControlOptions,
  parseCellControl,
  type CellControl,
} from "../../model/CellControl";
import { expr2xy, xy2expr } from "../../shared/alphabet";

export const EDITABLES_SHEET = "__so_editables";

export type EditableCellRef = {
  sheetName: string;
  ref: string;
  control?: CellControl;
};

export function isEditablesSheet(name?: string): boolean {
  return (name ?? "").trim() === EDITABLES_SHEET;
}

export function hasEditablesSheet(excel: ExcelJS.Workbook): boolean {
  return excel.worksheets.some((item) => isEditablesSheet(item.name));
}

export function readEditControlEnabled(excel: ExcelJS.Workbook): boolean {
  const sheet = editablesWorksheet(excel);
  if (!sheet) {
    return false;
  }
  const mode = String(sheet.getCell(1, 5).value ?? "").trim().toLowerCase();
  if (mode === "off" || mode === "0" || mode === "false") {
    return false;
  }
  return true;
}

export function readEditables(excel: ExcelJS.Workbook): EditableCellRef[] {
  const sheet = editablesWorksheet(excel);
  if (!sheet) {
    return [];
  }
  const items: EditableCellRef[] = [];
  const seen = new Set<string>();
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const sheetName = String(row.getCell(1).value ?? "").trim();
    const ref = String(row.getCell(2).value ?? "").trim().toUpperCase();
    if (!sheetName || !ref || sheetName.startsWith("__") || isEditablesSheet(sheetName)) {
      return;
    }
    const key = `${sheetName}\u0001${ref}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const control = parseCellControl(
      String(row.getCell(3).value ?? ""),
      decodeControlOptions(String(row.getCell(4).value ?? "")),
    );
    items.push(control ? { sheetName, ref, control } : { sheetName, ref });
  });
  return items;
}

export function writeEditables(excel: ExcelJS.Workbook, book: Workbook): void {
  const items: EditableCellRef[] = [];
  const seen = new Set<string>();
  for (const sheet of book.sheets) {
    if (isEditablesSheet(sheet.name)) {
      continue;
    }
    const controls = new Map(sheet.listCellControls().map((item) => [`${item.ri},${item.ci}`, item.control]));
    for (const cell of sheet.listEditableCells()) {
      const ref = xy2expr(cell.ci, cell.ri);
      const key = `${sheet.name}\u0001${ref}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const control = controls.get(`${cell.ri},${cell.ci}`);
      items.push(control ? { sheetName: sheet.name, ref, control } : { sheetName: sheet.name, ref });
    }
  }
  const previous = excel.worksheets.find((item) => isEditablesSheet(item.name));
  if (previous) {
    excel.removeWorksheet(previous.id);
  }
  const enabled = book.keepEditables || book.enforceEditLock;
  if (!enabled && !items.length) {
    return;
  }
  const hidden = excel.addWorksheet(EDITABLES_SHEET, { state: "hidden" });
  hidden.state = "hidden";
  hidden.getCell(1, 1).value = "sheet";
  hidden.getCell(1, 2).value = "ref";
  hidden.getCell(1, 3).value = "control";
  hidden.getCell(1, 4).value = "options";
  hidden.getCell(1, 5).value = enabled ? "on" : "off";
  items.forEach((item, index) => {
    hidden.getCell(index + 2, 1).value = item.sheetName;
    hidden.getCell(index + 2, 2).value = item.ref;
    if (item.control) {
      hidden.getCell(index + 2, 3).value = item.control.kind;
      if (item.control.kind === "dropdown") {
        hidden.getCell(index + 2, 4).value = encodeControlOptions(item.control.options);
      }
    }
  });
}

export function applyEditablesToWorkbook(book: Workbook, items: EditableCellRef[]): void {
  const bySheet = new Map<string, EditableCellRef[]>();
  for (const item of items) {
    const sheetName = item.sheetName.trim();
    const ref = item.ref.trim().toUpperCase();
    if (!sheetName || !ref) {
      continue;
    }
    const list = bySheet.get(sheetName) ?? [];
    list.push({ ...item, sheetName, ref });
    bySheet.set(sheetName, list);
  }
  const visible = book.sheets.filter((sheet) => !isEditablesSheet(sheet.name));
  for (const sheet of visible) {
    const wanted = sheet.name.trim();
    const cells =
      bySheet.get(sheet.name)
      ?? bySheet.get(wanted)
      ?? [...bySheet.entries()].find(([name]) => name.trim() === wanted)?.[1]
      ?? [];
    const coords: Array<{ ri: number; ci: number }> = [];
    const controls: Array<{ ri: number; ci: number; control: CellControl }> = [];
    for (const item of cells) {
      const [ci, ri] = expr2xy(item.ref);
      if (ri < 0 || ci < 0 || !Number.isFinite(ri) || !Number.isFinite(ci)) {
        continue;
      }
      coords.push({ ri, ci });
      if (item.control) {
        controls.push({ ri, ci, control: item.control });
      }
    }
    sheet.setEditableCells(coords);
    sheet.setCellControls(controls);
  }
}

function editablesWorksheet(excel: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  return excel.worksheets.find((item) => isEditablesSheet(item.name))
    ?? excel.getWorksheet(EDITABLES_SHEET);
}
