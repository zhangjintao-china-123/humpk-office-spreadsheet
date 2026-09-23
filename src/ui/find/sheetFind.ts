import { cellDisplay, cellNoteText } from "../../model/Cell";
import type { Sheet } from "../../model/Sheet";
import type { Workbook } from "../../model/Workbook";
import { xy2expr } from "../../shared/alphabet";

export type FindLookIn = "formulas" | "values" | "comments";
export type FindSearchBy = "rows" | "columns";
export type FindWithin = "sheet" | "workbook";

export interface FindOptions {
  query: string;
  matchCase: boolean;
  matchEntire: boolean;
  lookIn: FindLookIn;
  searchBy: FindSearchBy;
  within: FindWithin;
}

export interface FindHit {
  sheetIndex: number;
  sheetName: string;
  ri: number;
  ci: number;
  address: string;
  value: string;
}

export interface FindCursor {
  sheetIndex: number;
  ri: number;
  ci: number;
}

export const DEFAULT_FIND_OPTIONS: FindOptions = {
  query: "",
  matchCase: false,
  matchEntire: false,
  lookIn: "values",
  searchBy: "rows",
  within: "sheet",
};

export function isSearchableSheet(sheet: Sheet): boolean {
  return !sheet.name.trim().startsWith("__");
}

export function cellSearchText(sheet: Sheet, ri: number, ci: number, lookIn: FindLookIn): string {
  const cell = sheet.getCell(ri, ci);
  if (lookIn === "comments") {
    return cellNoteText(cell);
  }
  if (lookIn === "formulas") {
    return cell?.text ?? "";
  }
  return cellDisplay(cell, sheet.getCellStyle(ri, ci));
}

export function textMatches(value: string, query: string, matchCase: boolean, matchEntire: boolean): boolean {
  if (query === "") {
    return false;
  }
  const hay = matchCase ? value : value.toLowerCase();
  const pin = matchCase ? query : query.toLowerCase();
  return matchEntire ? hay === pin : hay.includes(pin);
}

export function replaceInCellText(
  source: string,
  query: string,
  replacement: string,
  options: { matchCase: boolean; matchEntire: boolean; all: boolean },
): { text: string; count: number } | undefined {
  if (!textMatches(source, query, options.matchCase, options.matchEntire)) {
    return undefined;
  }
  if (options.matchEntire) {
    return { text: replacement, count: 1 };
  }
  const flags = `${options.all ? "g" : ""}${options.matchCase ? "" : "i"}`;
  const re = new RegExp(escapeRegExp(query), flags);
  let count = 0;
  const text = source.replace(re, () => {
    count += 1;
    return replacement;
  });
  if (!count) {
    return undefined;
  }
  return { text, count };
}

export function listFindHits(book: Workbook, options: FindOptions, activeIndex = book.activeIndex): FindHit[] {
  const query = options.query;
  if (query === "") {
    return [];
  }
  const sheets = findSheets(book, options.within, activeIndex);
  const hits: FindHit[] = [];
  for (const { sheet, sheetIndex } of sheets) {
    hits.push(...hitsInSheet(sheet, sheetIndex, options));
  }
  hits.sort((a, b) => compareHits(a, b, options.searchBy));
  return hits;
}

export function nextFindHit(hits: FindHit[], cursor: FindCursor, backward = false): FindHit | undefined {
  if (!hits.length) {
    return undefined;
  }
  if (backward) {
    for (let i = hits.length - 1; i >= 0; i -= 1) {
      if (compareHits(hits[i], cursor, "rows") < 0) {
        return hits[i];
      }
    }
    return hits[hits.length - 1];
  }
  for (const hit of hits) {
    if (compareHits(hit, cursor, "rows") > 0) {
      return hit;
    }
  }
  return hits[0];
}

export function nextFindHitBySearch(
  hits: FindHit[],
  cursor: FindCursor,
  searchBy: FindSearchBy,
  backward = false,
): FindHit | undefined {
  if (!hits.length) {
    return undefined;
  }
  if (backward) {
    for (let i = hits.length - 1; i >= 0; i -= 1) {
      if (compareHits(hits[i], cursor, searchBy) < 0) {
        return hits[i];
      }
    }
    return hits[hits.length - 1];
  }
  for (const hit of hits) {
    if (compareHits(hit, cursor, searchBy) > 0) {
      return hit;
    }
  }
  return hits[0];
}

export function compareHits(
  a: FindCursor,
  b: FindCursor,
  searchBy: FindSearchBy,
): number {
  if (a.sheetIndex !== b.sheetIndex) {
    return a.sheetIndex - b.sheetIndex;
  }
  if (searchBy === "columns") {
    if (a.ci !== b.ci) {
      return a.ci - b.ci;
    }
    return a.ri - b.ri;
  }
  if (a.ri !== b.ri) {
    return a.ri - b.ri;
  }
  return a.ci - b.ci;
}

function findSheets(
  book: Workbook,
  within: FindWithin,
  activeIndex: number,
): Array<{ sheet: Sheet; sheetIndex: number }> {
  if (within === "sheet") {
    const sheet = book.sheets[activeIndex];
    return sheet && isSearchableSheet(sheet) ? [{ sheet, sheetIndex: activeIndex }] : [];
  }
  return book.sheets
    .map((sheet, sheetIndex) => ({ sheet, sheetIndex }))
    .filter((item) => isSearchableSheet(item.sheet));
}

function hitsInSheet(sheet: Sheet, sheetIndex: number, options: FindOptions): FindHit[] {
  const seen = new Set<string>();
  const hits: FindHit[] = [];
  sheet.rows.each((ri, row) => {
    if (!row.cells) {
      return;
    }
    for (const key of Object.keys(row.cells)) {
      const ci = Number(key);
      if (!Number.isInteger(ci) || ci < 0) {
        continue;
      }
      const origin = sheet.mergeOrigin(ri, ci);
      const id = `${origin.ri},${origin.ci}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      const value = cellSearchText(sheet, origin.ri, origin.ci, options.lookIn);
      if (!textMatches(value, options.query, options.matchCase, options.matchEntire)) {
        continue;
      }
      hits.push({
        sheetIndex,
        sheetName: sheet.name,
        ri: origin.ri,
        ci: origin.ci,
        address: xy2expr(origin.ci, origin.ri),
        value,
      });
    }
  });
  return hits;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
