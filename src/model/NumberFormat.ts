import { fromExcelSerial, toExcelSerial } from "../formula/functions";

export type NumberFormatPreset = {
  id: string;
  label: string;
  code: string;
};

export const ACCOUNTING_FORMAT = '_(¥* #,##0.00_);_(¥* (#,##0.00);_(¥* "-"??_);_(@_)';
export const ACCOUNTING_USD = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
export const ACCOUNTING_EUR = '_(€* #,##0.00_);_(€* (#,##0.00);_(€* "-"??_);_(@_)';
export const CURRENCY_FORMAT = "¥#,##0.00";
export const NUMBER_FORMAT = "0.00";

export const NUMBER_FORMATS: NumberFormatPreset[] = [
  { id: "general", label: "常规", code: "General" },
  { id: "number", label: "数值", code: NUMBER_FORMAT },
  { id: "currency", label: "货币", code: CURRENCY_FORMAT },
  { id: "accounting", label: "会计专用", code: ACCOUNTING_FORMAT },
  { id: "shortDate", label: "短日期", code: "yyyy/m/d" },
  { id: "longDate", label: "长日期", code: 'yyyy"年"m"月"d"日"' },
  { id: "time", label: "时间", code: "h:mm:ss" },
  { id: "percent", label: "百分比", code: "0.00%" },
  { id: "fraction", label: "分数", code: "# ?/?" },
  { id: "scientific", label: "科学记数", code: "0.00E+00" },
  { id: "text", label: "文本", code: "@" },
];

export const CURRENCY_FORMATS = [
  { label: "人民币 ¥", code: ACCOUNTING_FORMAT },
  { label: "美元 $", code: ACCOUNTING_USD },
  { label: "欧元 €", code: ACCOUNTING_EUR },
];

export const COMMA_FORMAT = ACCOUNTING_FORMAT;
export const PERCENT_FORMAT = "0.00%";

export function isAccountingFormat(code?: string): boolean {
  const normalized = normalizeFormat(code);
  return normalized.includes("*#,##0") || /_\([¥$€]?\*/.test(normalized);
}

export function isNumericDisplayFormat(code?: string): boolean {
  const id = formatPresetId(code);
  return id === "number" || id === "currency" || id === "accounting" || id === "percent" || id === "scientific";
}

export function isGeneralFormat(code?: string): boolean {
  const text = code?.trim() ?? "";
  return !text || /^general$/i.test(text);
}

export function isTextFormat(code?: string): boolean {
  return (code?.trim() ?? "") === "@";
}

const SCIENTIFIC_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+$/;

export function looksLikeScientificText(text: string): boolean {
  return SCIENTIFIC_TEXT.test(text.trim());
}

/** 把数字写成普通十进制文本，避免 JS 默认的 1e+21 / 1.23e-10。 */
export function formatPlainNumber(n: number): string {
  if (!Number.isFinite(n)) {
    return String(n);
  }
  if (Object.is(n, -0)) {
    return "0";
  }
  if (Number.isInteger(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER) {
    return String(n);
  }
  const text = n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
  return text === "-0" ? "0" : text;
}

export function expandScientificText(text: string): string | null {
  const trimmed = text.trim();
  if (!looksLikeScientificText(trimmed)) {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? formatPlainNumber(n) : null;
}

function formatAsText(raw: string | number): string {
  if (typeof raw === "number") {
    return formatPlainNumber(raw);
  }
  return expandScientificText(raw) ?? raw;
}

export function formatPresetId(code?: string): string {
  const normalized = normalizeFormat(code);
  if (isAccountingFormat(code)) {
    return "accounting";
  }
  const exact = NUMBER_FORMATS.find((item) => normalizeFormat(item.code) === normalized);
  if (exact) {
    return exact.id;
  }
  if (normalized === "@") {
    return "text";
  }
  if (normalized.includes("%")) {
    return "percent";
  }
  if (/e[+\-]/i.test(normalized)) {
    return "scientific";
  }
  if (isTimeFormat(normalized)) {
    return "time";
  }
  if (isDateFormat(normalized)) {
    return normalized.includes("年") ? "longDate" : "shortDate";
  }
  if (/[¥$€]/.test(normalized)) {
    return "currency";
  }
  if (normalized.includes("#,##0") || /^0(\.0+)?$/.test(normalized)) {
    return "number";
  }
  return isGeneralFormat(code) ? "general" : "custom";
}

export function formatPresetLabel(code?: string): string {
  const id = formatPresetId(code);
  if (id === "custom") {
    return "自定义";
  }
  return NUMBER_FORMATS.find((item) => item.id === id)?.label ?? "常规";
}

export function formatCellValue(raw: string | number | boolean | undefined, code?: string): string {
  if (raw === undefined || raw === "") {
    return "";
  }
  if (typeof raw === "boolean") {
    return raw ? "TRUE" : "FALSE";
  }
  if (isTextFormat(code)) {
    return formatAsText(raw);
  }
  if (isGeneralFormat(code)) {
    return formatGeneral(raw);
  }
  const fmt = pickSection(code ?? "General", toNumeric(raw));
  if (fmt === "@") {
    return formatAsText(raw);
  }
  if (isDateFormat(fmt) || isTimeFormat(fmt)) {
    const serial = toDateSerial(raw);
    if (serial === null) {
      return String(raw);
    }
    return formatDateTime(serial, fmt);
  }
  const numeric = toNumeric(raw);
  if (numeric === null) {
    return String(raw);
  }
  if (/\?\/\?/.test(fmt)) {
    return formatFraction(numeric);
  }
  if (/e[+\-]/i.test(fmt)) {
    return formatScientific(numeric, fmt);
  }
  if (fmt.includes("%")) {
    return formatPercent(numeric, fmt);
  }
  if (isAccountingFormat(code)) {
    return formatAccounting(numeric, code ?? fmt);
  }
  return formatNumberPattern(numeric, fmt);
}

export function bumpDecimalPlaces(code: string | undefined, delta: number): string {
  const raw = code?.trim() || "General";
  if (raw === "@" || isDateFormat(raw) || isTimeFormat(raw) || /\?\/\?/.test(raw)) {
    return raw;
  }
  if (isGeneralFormat(raw)) {
    return delta > 0 ? "0.0" : "General";
  }
  const match = /\.(0+)/.exec(raw);
  if (match) {
    const next = match[1].length + delta;
    if (next <= 0) {
      return raw.replace(/\.0+/g, "");
    }
    return raw.replace(/\.0+/g, `.${"0".repeat(next)}`);
  }
  if (delta <= 0) {
    return raw;
  }
  if (raw.includes("%")) {
    return raw.replace("%", `.${"0".repeat(delta)}%`);
  }
  if (/e[+\-]/i.test(raw)) {
    return raw.replace(/0(?=E)/i, `0.${"0".repeat(delta)}`);
  }
  if (/[0#]/.test(raw)) {
    return raw.replace(/([0#])(?![0#.,])/, `$1.${"0".repeat(delta)}`);
  }
  return `0.${"0".repeat(delta)}`;
}

function normalizeFormat(code?: string): string {
  return (code?.trim() || "General").replace(/\s+/g, "");
}

function toNumeric(raw: string | number): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const text = raw.trim();
  if (!text) {
    return null;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function toDateSerial(raw: string | number): number | null {
  const numeric = toNumeric(raw);
  if (numeric !== null) {
    return numeric;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const parsed = Date.parse(raw.replace(/年|月/g, "-").replace(/日/g, ""));
  return Number.isFinite(parsed) ? toExcelSerial(new Date(parsed)) : null;
}

function formatGeneral(raw: string | number): string {
  if (typeof raw === "string") {
    return raw;
  }
  return formatGeneralNumber(raw);
}

function formatGeneralNumber(n: number): string {
  if (!Number.isFinite(n)) {
    return String(n);
  }
  if (Object.is(n, -0)) {
    return "0";
  }
  const abs = Math.abs(n);
  if ((abs >= 1e11 || (abs > 0 && abs < 1e-9)) && abs !== 0) {
    return formatGeneralScientific(n);
  }
  // Excel 常规约 11 位有效数字。toFixed(10) 会把大数的二进制误差展开成 956180638.4800000191。
  const rounded = Number(n.toPrecision(11));
  const roundedAbs = Math.abs(rounded);
  if (Object.is(rounded, -0) || rounded === 0) {
    return "0";
  }
  if ((roundedAbs >= 1e11 || (roundedAbs > 0 && roundedAbs < 1e-9))) {
    return formatGeneralScientific(rounded);
  }
  return formatPlainNumber(rounded);
}

function formatGeneralScientific(n: number): string {
  return n.toExponential(2).replace(/e\+?/, "E+").replace("E+-", "E-");
}

function pickSection(code: string, n: number | null): string {
  const parts = splitSections(code);
  if (n === null) {
    return parts[0] ?? code;
  }
  if (n < 0 && parts[1]) {
    return parts[1];
  }
  if (n === 0 && parts[2]) {
    return parts[2];
  }
  return parts[0] ?? code;
}

function splitSections(code: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote = false;
  for (const ch of code) {
    if (ch === '"') {
      quote = !quote;
      current += ch;
      continue;
    }
    if (ch === ";" && !quote) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function isDateFormat(fmt: string): boolean {
  if (fmt.includes("%")) {
    return false;
  }
  if (/y|年|月|日|mmm|dddd/i.test(fmt)) {
    return true;
  }
  return /(?:^|[^h])m[.\/\-]?d/i.test(fmt.replace(/"/g, ""));
}

function isTimeFormat(fmt: string): boolean {
  return /h:mm|h:m|时|分|秒|:ss/i.test(fmt);
}

export function looksLikeDateFormat(code?: string): boolean {
  const fmt = code?.trim() ?? "";
  return !!fmt && isDateFormat(fmt);
}

export function formulaBarDateText(serial: number): string {
  const date = fromExcelSerial(serial);
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const dateText = `${y}/${m}/${d}`;
  const frac = ((serial % 1) + 1) % 1;
  if (frac < 1e-9) {
    return dateText;
  }
  const hours = Math.floor(frac * 24 + 1e-9);
  const minutes = Math.floor(frac * 24 * 60 + 1e-9) % 60;
  const seconds = Math.floor(frac * 24 * 3600 + 1e-9) % 60;
  if (seconds > 0) {
    return `${dateText} ${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${dateText} ${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatDateTime(serial: number, fmt: string): string {
  const date = fromExcelSerial(serial);
  const yyyy = String(date.getUTCFullYear());
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const hours = Math.floor((serial % 1) * 24 + 1e-9);
  const minutes = Math.floor((serial % 1) * 24 * 60 + 1e-9) % 60;
  const seconds = Math.floor((serial % 1) * 24 * 3600 + 1e-9) % 60;
  return replaceQuoted(fmt, (token) =>
    token
      .replace(/yyyy/gi, yyyy)
      .replace(/yy/gi, yyyy.slice(-2))
      .replace(/mmmm/gi, String(m))
      .replace(/mm/g, String(isTimeFormat(fmt) ? minutes : m).padStart(2, "0"))
      .replace(/ss/gi, String(seconds).padStart(2, "0"))
      .replace(/dd/gi, String(d).padStart(2, "0"))
      .replace(/hh/gi, String(hours).padStart(2, "0"))
      .replace(/h/gi, String(hours))
      .replace(/m/g, String(isTimeFormat(fmt) && !/[ymd]/.test(fmt) ? minutes : m))
      .replace(/d/gi, String(d)),
  );
}

function replaceQuoted(fmt: string, apply: (token: string) => string): string {
  return fmt
    .split(/(".*?")/)
    .map((part) => (part.startsWith('"') && part.endsWith('"') ? part.slice(1, -1) : apply(part)))
    .join("");
}

function formatPercent(n: number, fmt: string): string {
  const decimals = (/\.(0+)/.exec(fmt)?.[1].length) ?? 0;
  const scaled = n * 100;
  const body = formatGrouped(scaled, decimals, fmt.includes(","));
  const prefix = fmt.replace(/[#0,.]+%/, "").replace(/"/g, "");
  return `${prefix}${body}%`;
}

function formatScientific(n: number, fmt: string): string {
  const decimals = (/\.(0+)/.exec(fmt)?.[1].length) ?? 2;
  return n.toExponential(decimals).replace(/e\+?/, "E+").replace("E+-", "E-");
}

function formatFraction(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const frac = abs - whole;
  if (frac < 1e-9) {
    return `${sign}${whole}`;
  }
  let bestDen = 1;
  let bestNum = 1;
  let bestErr = 1;
  for (let den = 1; den <= 9; den += 1) {
    const num = Math.round(frac * den);
    const err = Math.abs(frac - num / den);
    if (err < bestErr) {
      bestErr = err;
      bestNum = num;
      bestDen = den;
    }
  }
  if (bestNum === 0) {
    return `${sign}${whole}`;
  }
  if (bestNum === bestDen) {
    return `${sign}${whole + 1}`;
  }
  return whole ? `${sign}${whole} ${bestNum}/${bestDen}` : `${sign}${bestNum}/${bestDen}`;
}

function formatAccounting(n: number, code: string): string {
  const decimals = (/\.(0+)/.exec(code)?.[1].length) ?? 2;
  const symbol = code.match(/[¥$€]/)?.[0] ?? "";
  if (Math.abs(n) < 1e-12) {
    return symbol ? `${symbol} -` : "-";
  }
  const body = formatGrouped(Math.abs(n), decimals, true);
  if (n < 0) {
    return symbol ? `${symbol} (${body})` : `(${body})`;
  }
  return symbol ? `${symbol} ${body}` : body;
}

function formatNumberPattern(n: number, fmt: string): string {
  const decimals = (/\.(0+)/.exec(fmt)?.[1].length) ?? (fmt.includes(".") ? 0 : 0);
  const grouped = fmt.includes(",");
  const abs = formatGrouped(Math.abs(n), decimals, grouped);
  const prefix = fmt.match(/^[^#0.,]+/)?.[0]?.replace(/"/g, "") ?? "";
  const suffix = fmt.match(/[^#0.,%]+$/)?.[0]?.replace(/"/g, "") ?? "";
  const sign = n < 0 ? "-" : "";
  return `${sign}${prefix}${abs}${suffix}`;
}

function formatGrouped(n: number, decimals: number, grouped: boolean): string {
  const fixed = n.toFixed(Math.max(0, decimals));
  if (!grouped) {
    return fixed;
  }
  const [intPart, frac] = fixed.split(".");
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac !== undefined ? `${groupedInt}.${frac}` : groupedInt;
}
