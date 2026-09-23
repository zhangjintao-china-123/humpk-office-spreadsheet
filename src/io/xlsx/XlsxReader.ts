import ExcelJS from "exceljs";
import type { Cell } from "../../model/Cell";
import { CellRange } from "../../model/CellRange";
import { stylesEqual, type Align, type BorderStyle, type CellStyle, type VAlign } from "../../model/CellStyle";
import { formatPlainNumber, isGeneralFormat, isTextFormat } from "../../model/NumberFormat";
import { Sheet } from "../../model/Sheet";
import { Workbook } from "../../model/Workbook";
import { xy2expr } from "../../shared/alphabet";
import { DEFAULT_COL_LEN, DEFAULT_COL_WIDTH, DEFAULT_ROW_LEN, PT_TO_PX } from "../../shared/constants";
import { excelColorToCss, type ExcelColor } from "./excelColor";
import { applyCellMarksToWorkbook, isCellMarksSheet, readCellMarks } from "./cellMarks";
import { applyCheckmarksToWorkbook, isCheckmarksSheet, readCheckmarks } from "./checkmarks";
import { applyEditablesToWorkbook, hasEditablesSheet, isEditablesSheet, readEditControlEnabled, readEditables } from "./editables";
import { excelNoteText } from "./cellNote";
import { readExcelImages } from "./imageAnchor";

const COL_CHAR_PX = 8;

export class XlsxReader {
  static async peekCheckmarks(buffer: ArrayBuffer): Promise<number> {
    const excel = new ExcelJS.Workbook();
    await excel.xlsx.load(buffer);
    return readCheckmarks(excel).length;
  }

  async read(buffer: ArrayBuffer): Promise<Workbook> {
    const excel = new ExcelJS.Workbook();
    await excel.xlsx.load(buffer);
    const book = new Workbook();
    book.sheets = [];
    excel.eachSheet((worksheet) => {
      if (isCheckmarksSheet(worksheet.name) || isEditablesSheet(worksheet.name) || isCellMarksSheet(worksheet.name)) {
        return;
      }
      book.sheets.push(this.readSheet(excel, worksheet));
    });
    if (book.sheets.length === 0) {
      book.sheets.push(new Sheet("Sheet1"));
    }
    book.activeIndex = 0;
    const marks = readCheckmarks(excel);
    applyCellMarksToWorkbook(book, readCellMarks(excel));
    applyCheckmarksToWorkbook(book, marks);
    applyEditablesToWorkbook(book, readEditables(excel));
    book.editControlConfigured = hasEditablesSheet(excel);
    if (book.editControlConfigured) {
      const enabled = readEditControlEnabled(excel);
      book.keepEditables = enabled;
      book.enforceEditLock = enabled;
    }
    for (const sheet of book.sheets) {
      sheet.refreshFilterView();
    }
    return book;
  }

  private readSheet(excel: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet): Sheet {
    const rowCount = Math.max(DEFAULT_ROW_LEN, worksheet.rowCount || 0);
    const colCount = Math.max(DEFAULT_COL_LEN, worksheet.columnCount || 0);
    const sheet = new Sheet(worksheet.name || "Sheet1", rowCount, colCount);
    const styles: CellStyle[] = [];

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const ri = rowNumber - 1;
      if (row.height) {
        sheet.rows.setHeight(ri, Math.round(row.height * PT_TO_PX));
      }
      row.eachCell({ includeEmpty: true }, (excelCell, colNumber) => {
        const ci = colNumber - 1;
        const cell = convertCell(excelCell);
        const style = preserveExcelTextStyle(excelCell, convertStyle(excelCell));
        if (style && !isEmptyStyle(style)) {
          cell.style = addStyle(styles, style);
        }
        if (cell.text || cell.style !== undefined || cell.note) {
          sheet.rows.setCell(ri, ci, cell);
        }
      });
    });

    sheet.styles = styles;
    applyColumns(worksheet, sheet);
    applyMerges(worksheet, sheet);
    readExcelImages(excel, worksheet, sheet);
    const filterRef = readAutoFilterRef(worksheet);
    if (filterRef) {
      sheet.autoFilter.setData({ ref: filterRef, filters: [], sort: null });
      sheet.alignAutoFilterHeader();
      sheet.refreshFilterView();
    }
    applyFreeze(worksheet, sheet);
    return sheet;
  }
}

function convertCell(excelCell: ExcelJS.Cell): Cell {
  const cell: Cell = {};
  const note = excelNoteText(excelCell.note);
  if (note) {
    cell.note = note;
  }
  const formula = excelCell.formula;
  if (formula) {
    cell.text = formula.startsWith("=") ? formula : `=${formula}`;
    return cell;
  }
  if (typeof excelCell.value === "number" && Number.isFinite(excelCell.value)) {
    cell.text = formatPlainNumber(excelCell.value);
    cell.value = excelCell.value;
    return cell;
  }
  cell.text = valueToText(excelCell.value);
  return cell;
}

function valueToText(value: ExcelJS.CellValue): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return formatPlainNumber(value);
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return formatDate(value);
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("result" in value && value.result !== undefined && value.result !== null) {
      return valueToText(value.result as ExcelJS.CellValue);
    }
    if ("error" in value && value.error) {
      return String(value.error);
    }
  }
  return String(value);
}

function isExcelTextCell(excelCell: ExcelJS.Cell): boolean {
  if (excelCell.type === ExcelJS.ValueType.String) {
    return true;
  }
  const value = excelCell.value;
  if (typeof value === "string") {
    return true;
  }
  return !!value && typeof value === "object" && "richText" in value && Array.isArray(value.richText);
}

function preserveExcelTextStyle(excelCell: ExcelJS.Cell, style: CellStyle | undefined): CellStyle | undefined {
  if (!isExcelTextCell(excelCell)) {
    return style;
  }
  if (style?.numFmt && !isGeneralFormat(style.numFmt) && !isTextFormat(style.numFmt)) {
    return style;
  }
  const next: CellStyle = { ...style, numFmt: "@" };
  return isEmptyStyle(next) ? undefined : next;
}

function convertStyle(excelCell: ExcelJS.Cell): CellStyle | undefined {
  const style: CellStyle = {};
  const font = excelCell.font;
  if (font) {
    style.font = {
      name: font.name,
      size: font.size,
      bold: !!font.bold,
      italic: !!font.italic,
    };
    if (font.color) {
      style.color = excelColorToCss(font.color as ExcelColor, "#0a0a0a");
    }
    if (font.underline) {
      style.underline = true;
    }
    if (font.strike) {
      style.strike = true;
    }
  }
  const align = excelCell.alignment;
  if (align) {
    style.align = mapAlign(align.horizontal);
    style.valign = mapVAlign(align.vertical);
    if (align.wrapText) {
      style.textwrap = true;
    }
  }
  const border = convertBorder(excelCell.border);
  if (border) {
    style.border = border;
  }
  const fill = excelCell.fill;
  if (fill && fill.type === "pattern") {
    const pattern = fill as ExcelJS.FillPattern;
    const fg = pattern.fgColor as ExcelColor | undefined;
    const bg = pattern.bgColor as ExcelColor | undefined;
    if (fg || bg) {
      style.bgcolor = excelColorToCss(fg ?? bg, "#ffffff");
    }
  }
  const numFmt = excelCell.numFmt?.trim();
  if (numFmt && !/^general$/i.test(numFmt)) {
    style.numFmt = numFmt;
  }
  return isEmptyStyle(style) ? undefined : style;
}

function convertBorder(border: Partial<ExcelJS.Borders> | undefined): BorderStyle | undefined {
  if (!border) {
    return undefined;
  }
  const out: BorderStyle = {};
  (["top", "right", "bottom", "left"] as const).forEach((side) => {
    const item = border[side];
    if (!item) {
      return;
    }
    out[side] = [item.style ?? "thin", excelColorToCss(item.color as ExcelColor | undefined, "#000000")];
  });
  return Object.keys(out).length ? out : undefined;
}

function applyColumns(worksheet: ExcelJS.Worksheet, sheet: Sheet): void {
  const count = Math.max(worksheet.columnCount || 0, worksheet.columns?.length || 0);
  for (let i = 1; i <= count; i += 1) {
    const width = worksheet.getColumn(i).width;
    if (width) {
      sheet.cols.setWidth(i - 1, Math.max(DEFAULT_COL_WIDTH / 2, Math.round(width * COL_CHAR_PX)));
    }
  }
}

function applyMerges(worksheet: ExcelJS.Worksheet, sheet: Sheet): void {
  const merges = (worksheet.model as { merges?: string[] }).merges ?? [];
  for (const ref of merges) {
    const range = CellRange.valueOf(ref);
    if (range.multiple()) {
      sheet.merge(range);
    }
  }
}

function addStyle(styles: CellStyle[], style: CellStyle): number {
  const found = styles.findIndex((item) => stylesEqual(item, style));
  if (found >= 0) {
    return found;
  }
  styles.push(style);
  return styles.length - 1;
}

function mapAlign(value: ExcelJS.Alignment["horizontal"] | undefined): Align | undefined {
  if (value === "left" || value === "center" || value === "right") {
    return value;
  }
  return undefined;
}

function mapVAlign(value: ExcelJS.Alignment["vertical"] | undefined): VAlign | undefined {
  if (value === "top" || value === "middle" || value === "bottom") {
    return value;
  }
  return undefined;
}

function isEmptyStyle(style: CellStyle): boolean {
  return !style.font && !style.align && !style.valign && !style.bgcolor && !style.color
    && !style.textwrap && !style.strike && !style.underline && !style.border && !style.numFmt;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function applyFreeze(worksheet: ExcelJS.Worksheet, sheet: Sheet): void {
  const view = worksheet.views?.find((item) => item.state === "frozen");
  if (!view || view.state !== "frozen") {
    return;
  }
  sheet.setFreeze(view.ySplit ?? 0, view.xSplit ?? 0);
}

function readAutoFilterRef(worksheet: ExcelJS.Worksheet): string | undefined {
  const filter = worksheet.autoFilter;
  if (!filter) {
    return undefined;
  }
  if (typeof filter === "string") {
    return filter;
  }
  const from = typeof filter.from === "string" ? filter.from : xy2expr(filter.from.column - 1, filter.from.row - 1);
  const to = typeof filter.to === "string" ? filter.to : xy2expr(filter.to.column - 1, filter.to.row - 1);
  return `${from}:${to}`;
}
