import { FormulaError } from "./FormulaError";

export interface PivotQuery {
  name: string;
  sheet?: string;
  filters: Record<string, string>;
}

const NAME_KEYS = new Set(["name", "title", "tabletitle", "table_title", "表格名称"]);
const SHEET_KEYS = new Set(["sheet", "sheetname", "页签", "工作表"]);

export function parsePivotPairs(pairs: string[]): PivotQuery {
  let name = "";
  let sheet: string | undefined;
  const filters: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq < 0) {
      throw new FormulaError("#VALUE!");
    }
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!key) {
      throw new FormulaError("#VALUE!");
    }
    if (NAME_KEYS.has(key.toLowerCase()) || NAME_KEYS.has(key)) {
      name = value;
    } else if (SHEET_KEYS.has(key.toLowerCase()) || SHEET_KEYS.has(key)) {
      sheet = value;
    } else {
      filters[key] = value;
    }
  }
  if (!name) {
    throw new FormulaError("#N/A");
  }
  return { name, sheet, filters };
}

/** Accept `D25` or `'Sheet1'!D25`. */
export function parseCrossCellRef(raw: string): { sheet?: string; ref: string } {
  const text = raw.trim();
  const bang = text.lastIndexOf("!");
  if (bang < 0) {
    return { ref: text };
  }
  let sheet = text.slice(0, bang).trim();
  if (sheet.startsWith("'") && sheet.endsWith("'") && sheet.length >= 2) {
    sheet = sheet.slice(1, -1).replaceAll("''", "'");
  }
  return { sheet, ref: text.slice(bang + 1).trim() };
}

export function toNumericOrNull(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function filterEquals(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  const a = String(left ?? "").trim();
  const b = String(right ?? "").trim();
  if (a === b) {
    return true;
  }
  const na = Number(a);
  const nb = Number(b);
  return a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

export function findTables<T extends SheetLike>(
  sheets: T[],
  name: string,
  filters: Record<string, string | number>,
  sheetName?: string,
): T[] {
  const matched = sheets.filter((sheet) => {
    if ((sheet.table ?? sheet.name).trim() !== name.trim()) {
      return false;
    }
    const stored = sheet.filters ?? {};
    for (const [key, value] of Object.entries(filters)) {
      if (!(key in stored) || !filterEquals(stored[key], value)) {
        return false;
      }
    }
    return true;
  });
  if (sheetName?.trim()) {
    const key = sheetName.trim().toLowerCase();
    return matched.filter((sheet) => sheet.name.trim().toLowerCase() === key);
  }
  return firstSheetPerTable(matched);
}

function firstSheetPerTable<T extends SheetLike>(sheets: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const sheet of sheets) {
    const id = sheet.table ?? sheet.name;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(sheet);
  }
  return result;
}

interface SheetLike {
  name: string;
  table?: string;
  filters?: Record<string, string | number>;
}
