import {
  expandScientificText,
  formatCellValue,
  formatPlainNumber,
  formulaBarDateText,
  isNumericDisplayFormat,
  isTextFormat,
  looksLikeDateFormat,
  looksLikeScientificText,
} from "./NumberFormat";
import type { Align, CellStyle } from "./CellStyle";

export interface Cell {
  text?: string;
  value?: string | number;
  style?: number;
  merge?: [number, number];
  note?: string;
}

export function cloneCell(cell: Cell | undefined): Cell | undefined {
  if (!cell) {
    return undefined;
  }
  return {
    ...cell,
    merge: cell.merge ? [cell.merge[0], cell.merge[1]] : undefined,
  };
}

export function cellIsBlank(cell: Cell | undefined): boolean {
  if (!cell) {
    return true;
  }
  return !cell.text
    && cell.style === undefined
    && !cell.merge
    && cell.value === undefined
    && !cell.note;
}

export function cellNoteText(cell: Cell | undefined): string {
  return cell?.note?.trim() ? cell.note : "";
}

export function isFormula(text: string | undefined): boolean {
  return !!text && text.startsWith("=");
}

export function cellEditText(cell: Cell | undefined, style?: CellStyle): string {
  if (!cell) {
    return "";
  }
  if (isFormula(cell.text) && !isTextFormat(style?.numFmt)) {
    return cell.text ?? "";
  }
  if (typeof cell.value === "number" && Number.isFinite(cell.value) && looksLikeDateFormat(style?.numFmt)) {
    return formulaBarDateText(cell.value);
  }
  const text = cell.text ?? "";
  if (isTextFormat(style?.numFmt) && looksLikeScientificText(text)) {
    return expandScientificText(text) ?? text;
  }
  return text;
}

export function cellDisplay(cell: Cell | undefined, style?: CellStyle): string {
  if (!cell) {
    return "";
  }
  if (isFormula(cell.text) && !isTextFormat(style?.numFmt)) {
    if (cell.value === undefined || cell.value === "") {
      return "";
    }
    return formatCellValue(cell.value, style?.numFmt);
  }
  if (isTextFormat(style?.numFmt) && !isFormula(cell.text)) {
    const literal = cell.text ?? "";
    if (literal !== "") {
      return expandScientificText(literal) ?? literal;
    }
  }
  if (cell.value !== undefined && cell.value !== "") {
    return formatCellValue(cell.value, style?.numFmt);
  }
  if (cell.text !== undefined && cell.text !== "") {
    return formatCellValue(cell.text, style?.numFmt);
  }
  return "";
}

/** Excel 常规：未指定水平对齐时，数字/日期靠右，文本靠左。 */
export function effectiveAlign(cell: Cell | undefined, raw: CellStyle, resolved?: CellStyle): Align {
  if (raw.align) {
    return raw.align;
  }
  const style = resolved ?? raw;
  if (isTextFormat(style.numFmt)) {
    return "left";
  }
  if (looksLikeDateFormat(style.numFmt) || isNumericDisplayFormat(style.numFmt)) {
    return "right";
  }
  if (typeof cell?.value === "number" && Number.isFinite(cell.value)) {
    return "right";
  }
  const text = (cell?.text ?? "").trim();
  if (!text || isFormula(text)) {
    return "left";
  }
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? "right" : "left";
}

/** 把数字单元格落成真正的文本，去掉科学计数显示。 */
export function materializeTextFormat(cell: Cell): void {
  if (isFormula(cell.text)) {
    return;
  }
  const text = cell.text ?? "";
  if (looksLikeScientificText(text)) {
    cell.text = expandScientificText(text)
      ?? (typeof cell.value === "number" ? formatPlainNumber(cell.value) : text);
  } else if (text === "" && cell.value !== undefined && cell.value !== "") {
    cell.text = typeof cell.value === "number" ? formatPlainNumber(cell.value) : String(cell.value);
  }
  delete cell.value;
}
