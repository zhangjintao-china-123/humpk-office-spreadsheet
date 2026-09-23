import type ExcelJS from "exceljs";
import type { ReconcileBadge } from "../../model/CellBadges";
import type { Workbook } from "../../model/Workbook";
import { expr2xy, xy2expr } from "../../shared/alphabet";

export const CHECKMARKS_SHEET = "__xld_checkmarks";

export function isCheckmarksSheet(name?: string): boolean {
  return (name ?? "").trim() === CHECKMARKS_SHEET;
}

export function readCheckmarks(excel: ExcelJS.Workbook): ReconcileBadge[] {
  const sheet =
    excel.worksheets.find((item) => isCheckmarksSheet(item.name))
    ?? excel.getWorksheet(CHECKMARKS_SHEET);
  if (!sheet) {
    return [];
  }
  const items: ReconcileBadge[] = [];
  const seen = new Set<string>();
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const sheetName = String(row.getCell(1).value ?? "").trim();
    const ref = String(row.getCell(2).value ?? "").trim().toUpperCase();
    if (!sheetName || !ref || isCheckmarksSheet(sheetName)) {
      return;
    }
    const key = `${sheetName}\u0001${ref}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    items.push({ sheetName, ref });
  });
  return items;
}

export function writeCheckmarks(
  excel: ExcelJS.Workbook,
  book: Workbook,
  persistedOnly = false,
): void {
  const items: ReconcileBadge[] = [];
  const seen = new Set<string>();
  for (const sheet of book.sheets) {
    if (isCheckmarksSheet(sheet.name)) {
      continue;
    }
    const cells = persistedOnly ? sheet.listPersistedCheckmarks() : sheet.listCheckmarks();
    for (const cell of cells) {
      const ref = xy2expr(cell.ci, cell.ri);
      const key = `${sheet.name}\u0001${ref}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({ sheetName: sheet.name, ref });
    }
  }
  const previous = excel.worksheets.find((item) => isCheckmarksSheet(item.name));
  if (previous) {
    excel.removeWorksheet(previous.id);
  }
  if (!items.length) {
    return;
  }
  const hidden = excel.addWorksheet(CHECKMARKS_SHEET, { state: "hidden" });
  hidden.state = "hidden";
  hidden.getCell(1, 1).value = "sheet";
  hidden.getCell(1, 2).value = "ref";
  items.forEach((item, index) => {
    hidden.getCell(index + 2, 1).value = item.sheetName;
    hidden.getCell(index + 2, 2).value = item.ref;
  });
}

export function applyCheckmarksToWorkbook(book: Workbook, items: ReconcileBadge[]): void {
  const bySheet = new Map<string, Array<{ ri: number; ci: number }>>();
  for (const item of items) {
    const sheetName = item.sheetName.trim();
    const ref = item.ref.trim().toUpperCase();
    if (!sheetName || !ref) {
      continue;
    }
    const [ci, ri] = expr2xy(ref);
    if (ri < 0 || ci < 0 || !Number.isFinite(ri) || !Number.isFinite(ci)) {
      continue;
    }
    const list = bySheet.get(sheetName) ?? [];
    list.push({ ri, ci });
    bySheet.set(sheetName, list);
  }
  const visible = book.sheets.filter((sheet) => !isCheckmarksSheet(sheet.name));
  for (const sheet of visible) {
    const wanted = sheet.name.trim();
    const cells =
      bySheet.get(sheet.name)
      ?? bySheet.get(wanted)
      ?? [...bySheet.entries()].find(([name]) => name.trim() === wanted)?.[1]
      ?? (visible.length === 1 && bySheet.size === 1 ? [...bySheet.values()][0] : undefined)
      ?? [];
    sheet.setCheckmarks(cells);
  }
}
