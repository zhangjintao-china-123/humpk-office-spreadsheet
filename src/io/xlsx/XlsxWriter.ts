import ExcelJS from "exceljs";
import { isFormula, type Cell } from "../../model/Cell";
import type { BorderStyle, CellStyle } from "../../model/CellStyle";
import { formatPlainNumber, isTextFormat } from "../../model/NumberFormat";
import type { Sheet } from "../../model/Sheet";
import type { Workbook } from "../../model/Workbook";
import { DEFAULT_COL_WIDTH, PT_TO_PX } from "../../shared/constants";
import { xy2expr } from "../../shared/alphabet";
import { writeCellMarks } from "./cellMarks";
import { writeCheckmarks } from "./checkmarks";
import { writeEditables } from "./editables";
import { writeExcelImages } from "./imageAnchor";

const COL_CHAR_PX = 8;

export class XlsxWriter {
  async write(book: Workbook, persistedCheckmarksOnly = false): Promise<ArrayBuffer> {
    const excel = new ExcelJS.Workbook();
    for (const sheet of book.sheets) {
      this.writeSheet(excel, sheet);
    }
    writeCheckmarks(excel, book, persistedCheckmarksOnly);
    writeEditables(excel, book);
    writeCellMarks(excel, book);
    const buffer = await excel.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
  }

  private writeSheet(excel: ExcelJS.Workbook, sheet: Sheet): void {
    const worksheet = excel.addWorksheet(sheet.name || "Sheet1");
    sheet.rows.each((ri, row) => {
      if (row.height !== undefined) {
        worksheet.getRow(ri + 1).height = row.height / PT_TO_PX;
      }
      if (!row.cells) {
        return;
      }
      for (const [key, cell] of Object.entries(row.cells)) {
        writeCell(worksheet, sheet, ri, Number(key), cell);
      }
    });
    writeColumns(worksheet, sheet);
    for (const ref of sheet.merges.getData()) {
      if (ref.includes(":")) {
        worksheet.mergeCells(ref);
      }
    }
    writeExcelImages(excel, worksheet, sheet);
    if (sheet.autoFilter.active() && sheet.autoFilter.ref) {
      worksheet.autoFilter = sheet.autoFilter.ref;
    }
    if (sheet.freezeIsActive()) {
      const [fri, fci] = sheet.freeze;
      worksheet.views = [{
        state: "frozen",
        xSplit: fci,
        ySplit: fri,
        topLeftCell: xy2expr(fci, fri),
      }];
    }
    for (const ri of sheet.autoFilter.hiddenRows) {
      worksheet.getRow(ri + 1).hidden = true;
    }
  }
}

function writeCell(worksheet: ExcelJS.Worksheet, sheet: Sheet, ri: number, ci: number, cell: Cell): void {
  const excelCell = worksheet.getCell(xy2expr(ci, ri));
  const text = cell.text ?? "";
  const style = cell.style === undefined ? undefined : sheet.styles[cell.style];
  if (isTextFormat(style?.numFmt)) {
    const literal = text !== ""
      ? text
      : typeof cell.value === "number"
        ? formatPlainNumber(cell.value)
        : cell.value !== undefined
          ? String(cell.value)
          : "";
    if (literal !== "") {
      excelCell.value = literal;
    }
  } else if (isFormula(text)) {
    excelCell.value = cell.value === undefined
      ? { formula: text.slice(1) }
      : { formula: text.slice(1), result: cell.value };
  } else if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    excelCell.value = cell.value;
  } else if (text !== "") {
    const n = Number(text);
    excelCell.value = Number.isFinite(n) && text.trim() !== "" ? n : text;
  }
  if (style) {
    applyStyle(excelCell, style);
  }
  if (cell.note?.trim()) {
    excelCell.note = cell.note;
  }
}

function applyStyle(excelCell: ExcelJS.Cell, style: CellStyle): void {
  if (style.font || style.color) {
    excelCell.font = {
      name: style.font?.name,
      size: style.font?.size,
      bold: style.font?.bold,
      italic: style.font?.italic,
      underline: style.underline,
      strike: style.strike,
      color: style.color ? { argb: cssToArgb(style.color) } : undefined,
    };
  }
  if (style.align || style.valign || style.textwrap) {
    excelCell.alignment = {
      horizontal: style.align,
      vertical: style.valign,
      wrapText: style.textwrap,
    };
  }
  if (style.border) {
    excelCell.border = excelBorder(style.border);
  }
  if (style.bgcolor && style.bgcolor !== "#ffffff") {
    excelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: cssToArgb(style.bgcolor) },
    };
  }
  if (style.numFmt && !/^general$/i.test(style.numFmt.trim())) {
    excelCell.numFmt = style.numFmt;
  }
}

function excelBorder(border: BorderStyle): Partial<ExcelJS.Borders> {
  const out: Partial<ExcelJS.Borders> = {};
  (["top", "right", "bottom", "left"] as const).forEach((side) => {
    const item = border[side];
    if (!item) {
      return;
    }
    out[side] = {
      style: (item[0] as ExcelJS.BorderStyle) || "thin",
      color: { argb: cssToArgb(item[1] || "#000000") },
    };
  });
  return out;
}

function writeColumns(worksheet: ExcelJS.Worksheet, sheet: Sheet): void {
  const data = sheet.cols.getData();
  for (const [key, value] of Object.entries(data)) {
    if (key === "len" || !value || typeof value !== "object") {
      continue;
    }
    const width = (value as { width?: number }).width;
    if (width === undefined || width === DEFAULT_COL_WIDTH) {
      continue;
    }
    worksheet.getColumn(Number(key) + 1).width = width / COL_CHAR_PX;
  }
}

function cssToArgb(css: string): string {
  const hex = css.replace("#", "").toLowerCase();
  if (hex.length === 3) {
    return `FF${[...hex].map((ch) => ch + ch).join("")}`.toUpperCase();
  }
  return `FF${hex.padStart(6, "0")}`.slice(-8).toUpperCase();
}
