import { describe, expect, it } from "vitest";
import { FormulaEngine } from "../../src/formula/FormulaEngine";
import { shiftFormula } from "../../src/formula/shiftRefs";
import { Sheet } from "../../src/model/Sheet";
import { Workbook } from "../../src/model/Workbook";

describe("formula engine", () => {
  it("evaluates arithmetic and functions", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "1");
    sheet.rows.setCellText(1, 0, "2");
    sheet.rows.setCellText(0, 1, "=A1+A2");
    sheet.rows.setCellText(1, 1, "=SUM(A1:A2)");
    sheet.rows.setCellText(2, 1, "=IF(A1>0,\"yes\",\"no\")");
    new FormulaEngine().recalculate(sheet);
    expect(sheet.getCell(0, 1)?.value).toBe(3);
    expect(sheet.getCell(1, 1)?.value).toBe(3);
    expect(sheet.getCell(2, 1)?.value).toBe("yes");
  });

  it("detects circular references", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "=A2");
    sheet.rows.setCellText(1, 0, "=A1");
    new FormulaEngine().recalculate(sheet);
    expect(String(sheet.getCell(0, 0)?.value)).toContain("#CIRCLE");
  });

  it("evaluates GETPIVOTDATA from workbook table catalog", () => {
    const summary = new Sheet("汇总");
    const sales = new Sheet("销售表 2024");
    sales.table = "销售表";
    sales.filters = { 年份: 2024 };
    sales.rows.setCellText(1, 1, "150");
    summary.rows.setCellText(0, 0, '=GETPIVOTDATA("B2", "name=销售表", "年份=2024")');
    const book = new Workbook();
    book.sheets = [summary, sales];
    const engine = new FormulaEngine();
    engine.attach(book);
    engine.recalculate(summary);
    expect(summary.getCell(0, 0)?.value).toBe(150);
  });

  it("shifts refs after insert and delete", () => {
    expect(shiftFormula("=SUM(A2:A4)", { type: "row", index: 1, count: 1 })).toBe("=SUM(A3:A5)");
    expect(shiftFormula("=B1", { type: "column", index: 0, count: 1 })).toBe("=C1");
    expect(shiftFormula("=A2", { type: "row", index: 1, count: -1 })).toBe("=#REF!");
  });

  it("resolves cross-sheet Sheet1!A1", () => {
    const book = Workbook.blank("Sheet1");
    book.addSheet("Sheet2");
    book.sheets[0].rows.setCellText(0, 0, "9");
    book.sheets[1].rows.setCellText(0, 0, "=Sheet1!A1*2");
    const engine = new FormulaEngine();
    engine.attach(book);
    engine.recalculate(book.sheets[1]);
    expect(book.sheets[1].getCell(0, 0)?.value).toBe(18);
  });

  it("concatenates with &", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "畅行");
    sheet.rows.setCellText(0, 1, `="编制单位:"&A1`);
    sheet.rows.setCellText(0, 2, `="a"&1+2`);
    new FormulaEngine().recalculate(sheet);
    expect(sheet.getCell(0, 1)?.value).toBe("编制单位:畅行");
    expect(sheet.getCell(0, 2)?.value).toBe("a3");
  });

  it("incremental recalc updates dependents only", () => {
    const book = Workbook.blank("S1");
    book.addSheet("S2");
    const engine = new FormulaEngine();
    engine.attach(book);
    const s1 = book.sheets[0];
    const s2 = book.sheets[1];
    s1.rows.setCellText(0, 0, "10");
    s1.rows.setCellText(0, 1, "=A1+1");
    s2.rows.setCellText(0, 0, "=S1!A1*2");
    s2.rows.setCellText(5, 5, "=1+1");
    engine.recalculate(s1);
    expect(s1.getCell(0, 1)?.value).toBe(11);
    expect(s2.getCell(0, 0)?.value).toBe(20);
    expect(s2.getCell(5, 5)?.value).toBe(2);

    s1.rows.setCellText(0, 0, "7");
    engine.recalculateAt([{ sheet: s1, ri: 0, ci: 0 }]);
    expect(s1.getCell(0, 0)?.value).toBe(7);
    expect(s1.getCell(0, 1)?.value).toBe(8);
    expect(s2.getCell(0, 0)?.value).toBe(14);
    expect(s2.getCell(5, 5)?.value).toBe(2);
    expect(engine.lastDirtyCount).toBeGreaterThan(0);
    expect(engine.lastDirtyCount).toBeLessThan(4);
  });
});
