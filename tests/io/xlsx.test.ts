import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { FormulaEngine } from "../../src/formula/FormulaEngine";
import { XlsxReader } from "../../src/io/xlsx/XlsxReader";
import { XlsxWriter } from "../../src/io/xlsx/XlsxWriter";
import { CellRange } from "../../src/model/CellRange";
import { Workbook } from "../../src/model/Workbook";

describe("xlsx import", () => {
  it("reads values, formula, style, merge and sizes", async () => {
    const excel = new ExcelJS.Workbook();
    const sheet = excel.addWorksheet("收入");
    sheet.getColumn(1).width = 12;
    sheet.getRow(1).height = 24;
    sheet.getCell("A1").value = 10;
    sheet.getCell("A1").font = { bold: true, name: "Arial", size: 12 };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
    sheet.getCell("B1").value = 20;
    sheet.getCell("C1").value = { formula: "A1+B1", result: 30 };
    sheet.getCell("A2").value = "合计";
    sheet.mergeCells("A2:B2");
    const buffer = await excel.xlsx.writeBuffer();

    const book = await new XlsxReader().read(buffer as ArrayBuffer);
    expect(book.sheets).toHaveLength(1);
    expect(book.sheets[0].name).toBe("收入");
    expect(book.sheets[0].getCell(0, 0)?.text).toBe("10");
    expect(book.sheets[0].getCell(0, 1)?.text).toBe("20");
    expect(book.sheets[0].getCell(0, 2)?.text).toBe("=A1+B1");
    expect(book.sheets[0].getCellStyle(0, 0).font?.bold).toBe(true);
    expect(book.sheets[0].getCellStyle(0, 0).align).toBe("center");
    expect(book.sheets[0].getCellStyle(0, 0).bgcolor?.toLowerCase()).toBe("#ffff00");
    expect(book.sheets[0].merges.getFirstIncludes(1, 1)?.toString()).toBe("A2:B2");
    expect(book.sheets[0].cols.getWidth(0)).toBeGreaterThan(60);
    expect(book.sheets[0].rows.getHeight(0)).toBeGreaterThan(20);
  });

  it("imports every worksheet", async () => {
    const excel = new ExcelJS.Workbook();
    excel.addWorksheet("一").getCell("A1").value = "a";
    excel.addWorksheet("二").getCell("A1").value = "b";
    const buffer = await excel.xlsx.writeBuffer();
    const book = await new XlsxReader().read(buffer as ArrayBuffer);
    expect(book.sheets.map((item) => item.name)).toEqual(["一", "二"]);
    expect(book.sheets[1].getCell(0, 0)?.text).toBe("b");
  });

  it("roundtrips values, formula, style and merge", async () => {
    const book = Workbook.blank("导出");
    const sheet = book.active();
    sheet.rows.setCellText(0, 0, "10");
    sheet.rows.setCellText(0, 1, "20");
    sheet.rows.setCellText(0, 2, "=A1+B1");
    sheet.applyStylePatch(CellRange.cell(0, 0), { font: { bold: true }, align: "center", bgcolor: "#ffff00" });
    sheet.rows.setCellText(1, 0, "合计");
    sheet.merge(CellRange.valueOf("A2:B2"));
    new FormulaEngine().recalculate(sheet);
    const buffer = await new XlsxWriter().write(book);
    const loaded = await new XlsxReader().read(buffer);
    expect(loaded.sheets[0].name).toBe("导出");
    expect(loaded.sheets[0].getCell(0, 0)?.text).toBe("10");
    expect(loaded.sheets[0].getCell(0, 2)?.text).toBe("=A1+B1");
    expect(loaded.sheets[0].getCellStyle(0, 0).font?.bold).toBe(true);
    expect(loaded.sheets[0].getCellStyle(0, 0).bgcolor?.toLowerCase()).toBe("#ffff00");
    expect(loaded.sheets[0].merges.getFirstIncludes(1, 1)?.toString()).toBe("A2:B2");
  });

  it("roundtrips autofilter range", async () => {
    const book = Workbook.blank("筛");
    const sheet = book.active();
    sheet.rows.setCellText(0, 0, "城市");
    sheet.rows.setCellText(1, 0, "北京");
    sheet.autoFilter.setData({ ref: "A1:A2" });
    sheet.refreshFilterView();
    const buffer = await new XlsxWriter().write(book);
    const loaded = await new XlsxReader().read(buffer);
    expect(loaded.sheets[0].autoFilter.active()).toBe(true);
    expect(loaded.sheets[0].autoFilter.ref).toBe("A1:A2");
  });

  it("roundtrips frozen panes", async () => {
    const book = Workbook.blank("冻");
    book.active().setFreeze(1, 1);
    const buffer = await new XlsxWriter().write(book);
    const loaded = await new XlsxReader().read(buffer);
    expect(loaded.sheets[0].freeze).toEqual([1, 1]);
  });

  it("roundtrips a floating image", async () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const book = Workbook.blank("图");
    book.active().images.add({
      id: 0,
      url: png,
      options: { left: 160, top: 90, width: 40, height: 20, scaleX: 2, scaleY: 2 },
    });
    const buffer = await new XlsxWriter().write(book);
    const loaded = await new XlsxReader().read(buffer);
    expect(loaded.sheets[0].images.size()).toBe(1);
    const image = loaded.sheets[0].images.list()[0];
    expect(image.url).toContain("base64");
    expect(image.options.width * (image.options.scaleX ?? 1)).toBeGreaterThan(10);
  });
});
