import { describe, expect, it } from "vitest";
import type { EditHost } from "../../src/edit/EditHost";
import { PaintFormatCommand, paintDestRange } from "../../src/edit/PaintFormatCommand";
import { FormulaEngine } from "../../src/formula/FormulaEngine";
import { CellRange } from "../../src/model/CellRange";
import { Sheet } from "../../src/model/Sheet";

function host(sheet: Sheet): EditHost {
  const engine = new FormulaEngine();
  return {
    sheet: () => sheet,
    engine: () => engine,
    afterChange() {},
  };
}

describe("paint format", () => {
  it("expands a single dest cell to the source size", () => {
    const dest = paintDestRange(2, 3, new CellRange(4, 1, 4, 1), 100, 26);
    expect(dest.toString()).toBe("B5:D6");
  });

  it("tiles when dest is larger than source", () => {
    const dest = paintDestRange(2, 1, new CellRange(0, 0, 4, 0), 100, 26);
    expect(dest.rowCount()).toBe(6);
    expect(dest.colCount()).toBe(1);
  });

  it("copies style without changing text", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "src");
    sheet.applyStylePatch(new CellRange(0, 0, 0, 0), { bgcolor: "#FFFF00", font: { bold: true } });
    sheet.rows.setCellText(2, 1, "keep");
    const styles = [[sheet.rawStyle(0, 0)]];
    new PaintFormatCommand(host(sheet), new CellRange(2, 1, 2, 1), styles).do();
    expect(sheet.getCell(2, 1)?.text).toBe("keep");
    expect(sheet.getCellStyle(2, 1).bgcolor).toBe("#FFFF00");
    expect(sheet.getCellStyle(2, 1).font?.bold).toBe(true);
  });
});
