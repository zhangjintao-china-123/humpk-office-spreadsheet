import { describe, expect, it } from "vitest";
import { FormulaEngine } from "../../src/formula/FormulaEngine";
import { shiftFormula } from "../../src/formula/shiftRefs";
import { Sheet } from "../../src/model/Sheet";

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

  it("shifts refs after insert and delete", () => {
    expect(shiftFormula("=SUM(A2:A4)", { type: "row", index: 1, count: 1 })).toBe("=SUM(A3:A5)");
    expect(shiftFormula("=B1", { type: "column", index: 0, count: 1 })).toBe("=C1");
    expect(shiftFormula("=A2", { type: "row", index: 1, count: -1 })).toBe("=#REF!");
  });
});
