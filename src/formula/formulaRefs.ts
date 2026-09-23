import { CellRange } from "../model/CellRange";
import { expr2xy, stringAt } from "../shared/alphabet";

export const FORMULA_REF_COLORS = [
  { stroke: "#5B9BD5", fill: "rgba(91, 155, 213, 0.16)" },
  { stroke: "#ED7D31", fill: "rgba(237, 125, 49, 0.16)" },
  { stroke: "#70AD47", fill: "rgba(112, 173, 71, 0.16)" },
  { stroke: "#FFC000", fill: "rgba(255, 192, 0, 0.18)" },
  { stroke: "#9E480E", fill: "rgba(158, 72, 14, 0.16)" },
  { stroke: "#7030A0", fill: "rgba(112, 48, 160, 0.16)" },
] as const;

export type FormulaAbs = { col: boolean; row: boolean };

export type FormulaRef = {
  start: number;
  end: number;
  raw: string;
  sheet?: string;
  sameSheet: boolean;
  range: CellRange;
  colorIndex: number;
  startAbs: FormulaAbs;
  endAbs: FormulaAbs;
};

const CELL = /\$?[A-Za-z]+\$?[0-9]+/y;
const UNQUOTED_SHEET = /[A-Za-z_][A-Za-z0-9_]*!/y;

export function scanFormulaRefs(text: string, currentSheet: string): FormulaRef[] {
  const refs: FormulaRef[] = [];
  let i = text.startsWith("=") ? 1 : 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const close = skipQuoted(text, i, '"');
      if (close < 0) {
        break;
      }
      scanStringRefs(text, i + 1, close, currentSheet, refs);
      i = close + 1;
      continue;
    }
    const sheet = readSheetPrefix(text, i);
    if (sheet) {
      const afterSheet = i + sheet.consumed;
      const pair = readCellOrRange(text, afterSheet);
      if (pair) {
        refs.push(makeRef(text, i, afterSheet + pair.consumed, sheet.name, currentSheet, pair, refs.length));
        i = afterSheet + pair.consumed;
        continue;
      }
      i += 1;
      continue;
    }
    const pair = readCellOrRange(text, i);
    if (pair) {
      refs.push(makeRef(text, i, i + pair.consumed, undefined, currentSheet, pair, refs.length));
      i += pair.consumed;
      continue;
    }
    i += 1;
  }
  return refs;
}

export function formatFormulaRange(range: CellRange, startAbs?: FormulaAbs, endAbs?: FormulaAbs): string {
  const start = formatCell(range.sci, range.sri, startAbs);
  if (!range.multiple()) {
    return start;
  }
  return `${start}:${formatCell(range.eci, range.eri, endAbs ?? startAbs)}`;
}

export function formulaColor(index: number): (typeof FORMULA_REF_COLORS)[number] {
  return FORMULA_REF_COLORS[index % FORMULA_REF_COLORS.length];
}

function makeRef(
  text: string,
  start: number,
  end: number,
  sheet: string | undefined,
  currentSheet: string,
  pair: { start: string; end?: string; consumed: number },
  colorIndex: number,
): FormulaRef {
  const startAbs = parseAbs(pair.start);
  const endAbs = pair.end ? parseAbs(pair.end) : startAbs;
  const [sci, sri] = expr2xy(pair.start);
  const [eci, eri] = pair.end ? expr2xy(pair.end) : [sci, sri];
  return {
    start,
    end,
    raw: text.slice(start, end),
    sheet,
    sameSheet: !sheet || sheet.toLowerCase() === currentSheet.toLowerCase(),
    range: new CellRange(sri, sci, eri, eci),
    colorIndex,
    startAbs,
    endAbs,
  };
}

function scanStringRefs(text: string, start: number, end: number, currentSheet: string, refs: FormulaRef[]): void {
  let i = start;
  while (i < end) {
    const sheet = readSheetPrefix(text, i);
    if (!sheet) {
      i += 1;
      continue;
    }
    const afterSheet = i + sheet.consumed;
    const pair = readCellOrRange(text, afterSheet);
    if (!pair) {
      i += 1;
      continue;
    }
    const sheetName = sheet.name.startsWith("[") ? sheet.name.slice(sheet.name.indexOf("]") + 1) : sheet.name;
    refs.push(makeRef(text, i, afterSheet + pair.consumed, sheetName, currentSheet, pair, refs.length));
    i = afterSheet + pair.consumed;
  }
}

function readSheetPrefix(text: string, i: number): { name: string; consumed: number } | undefined {
  if (text[i] === "'") {
    const close = skipQuoted(text, i, "'");
    if (close < 0 || text[close + 1] !== "!") {
      return undefined;
    }
    return { name: decodeQuoted(text.slice(i + 1, close)), consumed: close + 2 - i };
  }
  UNQUOTED_SHEET.lastIndex = i;
  const match = UNQUOTED_SHEET.exec(text);
  if (!match || match.index !== i) {
    return undefined;
  }
  return { name: match[0].slice(0, -1), consumed: match[0].length };
}

function readCellOrRange(
  text: string,
  i: number,
): { start: string; end?: string; consumed: number } | undefined {
  CELL.lastIndex = i;
  const start = CELL.exec(text);
  if (!start || start.index !== i) {
    return undefined;
  }
  let consumed = start[0].length;
  if (text[i + consumed] === ":") {
    CELL.lastIndex = i + consumed + 1;
    const end = CELL.exec(text);
    if (end && end.index === i + consumed + 1) {
      return { start: start[0], end: end[0], consumed: consumed + 1 + end[0].length };
    }
  }
  return { start: start[0], consumed };
}

function parseAbs(raw: string): FormulaAbs {
  const col = raw.match(/^\$?[A-Za-z]+/)?.[0] ?? "";
  return { col: col.startsWith("$"), row: raw.includes("$", col.length) };
}

function formatCell(ci: number, ri: number, abs?: FormulaAbs): string {
  const col = `${abs?.col ? "$" : ""}${stringAt(ci)}`;
  const row = `${abs?.row ? "$" : ""}${ri + 1}`;
  return `${col}${row}`;
}

function skipQuoted(text: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === quote) {
      if (text[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i;
    }
    i += 1;
  }
  return -1;
}

function decodeQuoted(value: string): string {
  return value.replaceAll("''", "'");
}
