import type { Cell } from "./Cell";
import { isFormula } from "./Cell";
import type { CellStyle } from "./CellStyle";
import { formulaBarDateText, isGeneralFormat, isTextFormat, looksLikeDateFormat } from "./NumberFormat";
import { CellRange } from "./CellRange";
import { hasExplicitBreak } from "../render/textLayout";
import type { Sheet } from "./Sheet";

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export type ParsedInput = {
  text: string;
  value?: number;
  numFmt?: string;
};

export function parseTypedInput(raw: string, currentFmt?: string): ParsedInput {
  if (raw === "") {
    return { text: "" };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { text: raw };
  }
  if (trimmed.startsWith("=")) {
    return { text: raw };
  }
  if (trimmed.startsWith("'")) {
    const text = trimmed.slice(1);
    if (isGeneralFormat(currentFmt) || isTextFormat(currentFmt)) {
      return { text, numFmt: "@" };
    }
    return { text };
  }
  if (isTextFormat(currentFmt)) {
    return { text: raw };
  }

  const special = tryParseSpecial(trimmed);
  if (!isGeneralFormat(currentFmt)) {
    return coerceToExisting(raw, trimmed, currentFmt, special);
  }
  if (special) {
    return { text: specialEditText(special, trimmed), value: special.value, numFmt: special.numFmt };
  }
  return { text: raw };
}

export function writeParsedInput(sheet: Sheet, ri: number, ci: number, parsed: ParsedInput): void {
  sheet.rows.setCellText(ri, ci, parsed.text);
  if (parsed.text === "") {
    return;
  }
  const cell = sheet.rows.getCellOrNew(ri, ci);
  if (parsed.value !== undefined) {
    cell.value = parsed.value;
  } else {
    delete cell.value;
  }
  if (parsed.numFmt) {
    const raw = sheet.rawStyle(ri, ci);
    cell.style = sheet.addStyle({ ...raw, numFmt: parsed.numFmt });
  }
  if (hasExplicitBreak(parsed.text)) {
    const raw = sheet.rawStyle(ri, ci);
    if (!raw.textwrap) {
      cell.style = sheet.addStyle({ ...raw, textwrap: true });
    }
    sheet.growRowsToFit(CellRange.cell(ri, ci));
  } else if (sheet.getCellStyle(ri, ci).textwrap) {
    sheet.growRowsToFit(CellRange.cell(ri, ci));
  }
}

export function syncLiteralValue(cell: Cell, numFmt?: string): void {
  const text = cell.text ?? "";
  if (isFormula(text)) {
    return;
  }
  if (text === "") {
    delete cell.value;
    return;
  }
  if (isTextFormat(numFmt)) {
    delete cell.value;
    return;
  }
  const n = Number(text);
  if (Number.isFinite(n) && text.trim() !== "") {
    const abs = Math.abs(n);
    const compact = text.trim();
    if ((abs >= 1e11 || (abs > 0 && abs < 1e-9)) && !/[eE]/.test(compact)) {
      delete cell.value;
      return;
    }
    cell.value = n;
    return;
  }
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return;
  }
  cell.value = text;
}

export function cellIsFormula(cell: Cell | undefined, style?: CellStyle): boolean {
  return isFormula(cell?.text) && !isTextFormat(style?.numFmt);
}

function coerceToExisting(
  raw: string,
  trimmed: string,
  currentFmt: string | undefined,
  special: { value: number; numFmt: string } | null,
): ParsedInput {
  const fmt = currentFmt ?? "";
  if (isDateFamily(fmt)) {
    if (special && isDateFamily(special.numFmt)) {
      return { text: specialEditText(special, trimmed), value: special.value };
    }
    const n = Number(trimmed);
    if (Number.isFinite(n) && trimmed !== "") {
      return {
        text: looksLikeDateFormat(fmt) ? formulaBarDateText(n) : trimmed,
        value: n,
      };
    }
    return { text: raw };
  }
  if (fmt.includes("%")) {
    if (special?.numFmt.includes("%")) {
      return { text: trimmed, value: special.value };
    }
    const n = Number(trimmed.replace(/,/g, ""));
    if (Number.isFinite(n) && trimmed !== "") {
      return { text: trimmed, value: n / 100 };
    }
    return { text: raw };
  }
  if (/[¥$€#0]/.test(fmt)) {
    if (special && !isDateFamily(special.numFmt) && !special.numFmt.includes("%")) {
      return { text: trimmed, value: special.value };
    }
    const n = Number(trimmed.replace(/,/g, ""));
    if (Number.isFinite(n) && trimmed !== "") {
      return { text: trimmed, value: n };
    }
    return { text: raw };
  }
  return { text: raw };
}

function tryParseSpecial(text: string): { value: number; numFmt: string } | null {
  return tryPercent(text) ?? tryCurrency(text) ?? tryDateTime(text) ?? tryDate(text) ?? tryTime(text);
}

function tryPercent(text: string): { value: number; numFmt: string } | null {
  const match = /^([+-]?)(\d+(?:\.\d+)?)\s*%$/.exec(text);
  if (!match) {
    return null;
  }
  const sign = match[1] === "-" ? -1 : 1;
  const body = match[2];
  const decimals = /\.(\d+)/.exec(body)?.[1].length ?? 0;
  const value = sign * Number(body) / 100;
  if (!Number.isFinite(value)) {
    return null;
  }
  const numFmt = decimals <= 0 ? "0%" : `0.${"0".repeat(decimals)}%`;
  return { value, numFmt };
}

function tryCurrency(text: string): { value: number; numFmt: string } | null {
  const match = /^([¥$€])\s*([+-]?)([0-9,]+(?:\.\d+)?)$/.exec(text);
  if (!match) {
    return null;
  }
  const symbol = match[1];
  const sign = match[2] === "-" ? -1 : 1;
  const body = match[3].replace(/,/g, "");
  if (!body || body === ".") {
    return null;
  }
  const value = sign * Number(body);
  if (!Number.isFinite(value)) {
    return null;
  }
  const decimals = /\.(\d+)/.exec(match[3])?.[1].length ?? 0;
  const numFmt = decimals <= 0 ? `${symbol}#,##0` : `${symbol}#,##0.${"0".repeat(decimals)}`;
  return { value, numFmt };
}

function tryDateTime(text: string): { value: number; numFmt: string } | null {
  const match = /^(.+?)\s+(\d{1,2}:\d{1,2}(?::\d{1,2})?)$/.exec(text);
  if (!match) {
    return null;
  }
  const date = tryDate(match[1]);
  const time = tryTime(match[2]);
  if (!date || !time) {
    return null;
  }
  const value = Math.floor(date.value) + (time.value % 1);
  const timeFmt = time.numFmt;
  return { value, numFmt: `${date.numFmt} ${timeFmt}` };
}

function tryDate(text: string): { value: number; numFmt: string } | null {
  text = text.replace(/[－—–−]/g, "-").replace(/\s*([/\-.])\s*/g, "$1");
  const cnFull = /^(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?$/.exec(text);
  if (cnFull) {
    const year = Number(cnFull[1]);
    const month = Number(cnFull[2]);
    const day = cnFull[3] ? Number(cnFull[3]) : 1;
    const serial = ymdSerial(year, month, day);
    if (serial === null) {
      return null;
    }
    return {
      value: serial,
      numFmt: cnFull[3] ? 'yyyy"年"m"月"d"日"' : 'yyyy"年"m"月"',
    };
  }
  const cnMd = /^(\d{1,2})月(?:(\d{1,2})日)?$/.exec(text);
  if (cnMd) {
    const month = Number(cnMd[1]);
    const day = cnMd[2] ? Number(cnMd[2]) : 1;
    const serial = ymdSerial(new Date().getFullYear(), month, day);
    if (serial === null) {
      return null;
    }
    return {
      value: serial,
      numFmt: cnMd[2] ? 'm"月"d"日"' : 'm"月"',
    };
  }
  const full = /^(\d{2,4})([/\-.])(\d{1,2})\2(\d{1,2})$/.exec(text);
  if (full) {
    const year = expandYear(Number(full[1]), full[1].length);
    const month = Number(full[3]);
    const day = Number(full[4]);
    const serial = ymdSerial(year, month, day);
    if (serial === null) {
      return null;
    }
    const sep = full[2];
    const yearToken = full[1].length === 2 ? "yy" : "yyyy";
    return { value: serial, numFmt: `${yearToken}${sep}m${sep}d` };
  }
  const md = /^(\d{1,2})([/\-])(\d{1,2})$/.exec(text);
  if (md) {
    const month = Number(md[1]);
    const day = Number(md[3]);
    const serial = ymdSerial(new Date().getFullYear(), month, day);
    if (serial === null) {
      return null;
    }
    return { value: serial, numFmt: 'm"月"d"日"' };
  }
  return null;
}

function tryTime(text: string): { value: number; numFmt: string } | null {
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(text);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }
  const value = (hours * 3600 + minutes * 60 + seconds) / 86400;
  return { value, numFmt: match[3] ? "h:mm:ss" : "h:mm" };
}

function expandYear(year: number, digits: number): number {
  if (digits > 2) {
    return year;
  }
  return year <= 29 ? 2000 + year : 1900 + year;
}

function ymdSerial(year: number, month: number, day: number): number | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return (utc - EXCEL_EPOCH) / 86400000;
}

function isDateFamily(fmt: string): boolean {
  return /y|年|月|日|mmm|dddd|h:mm|h:m|时|分|秒|:ss/i.test(fmt) && !fmt.includes("%");
}

function specialEditText(special: { value: number; numFmt: string }, fallback: string): string {
  if (looksLikeDateFormat(special.numFmt)) {
    return formulaBarDateText(special.value);
  }
  return fallback;
}
