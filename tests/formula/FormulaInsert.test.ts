import { describe, expect, it } from "vitest";
import { formulaStub, guessNumberRange } from "../../src/formula/FormulaInsert";
import { FormulaEngine } from "../../src/formula/FormulaEngine";
import { Sheet } from "../../src/model/Sheet";

describe("formula insert", () => {
  it("builds stubs", () => {
    expect(formulaStub("SUM")).toBe("=SUM()");
    expect(formulaStub("SUM", "A1:A3")).toBe("=SUM(A1:A3)");
    expect(formulaStub("IF")).toBe("=IF(,,)");
  });

  it("guesses a column of numbers above the cell", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "1");
    sheet.rows.setCellText(1, 0, "2");
    sheet.rows.setCellText(2, 0, "3");
    expect(guessNumberRange(sheet, 3, 0)).toBe("A1:A3");
  });

  it("guesses a row of numbers to the left", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "4");
    sheet.rows.setCellText(0, 1, "5");
    expect(guessNumberRange(sheet, 0, 2)).toBe("A1:B1");
  });

  it("uses formula results that are numbers", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "1");
    sheet.rows.setCellText(1, 0, "=A1+1");
    new FormulaEngine().recalculate(sheet);
    expect(guessNumberRange(sheet, 2, 0)).toBe("A1:A2");
  });

  it("returns undefined when neighbors are empty", () => {
    expect(guessNumberRange(new Sheet("s"), 0, 0)).toBeUndefined();
  });
});
