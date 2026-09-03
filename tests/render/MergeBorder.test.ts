import { describe, expect, it } from "vitest";
import { ApplyBorderCommand } from "../../src/edit/ApplyBorderCommand";
import type { EditHost } from "../../src/edit/EditHost";
import { FormulaEngine } from "../../src/formula/FormulaEngine";
import { CellRange } from "../../src/model/CellRange";
import { Sheet } from "../../src/model/Sheet";
import { paintableBorder } from "../../src/render/MergeBorder";

function host(sheet: Sheet): EditHost {
  const engine = new FormulaEngine();
  return {
    sheet: () => sheet,
    engine: () => engine,
    afterChange() {},
  };
}

describe("paintableBorder", () => {
  it("keeps all four sides on an isolated cell", () => {
    const sheet = new Sheet("s");
    new ApplyBorderCommand(host(sheet), CellRange.cell(0, 0), "all", "#000").do();
    const border = paintableBorder(sheet, 0, 0);
    expect(border?.top).toBeTruthy();
    expect(border?.right).toBeTruthy();
    expect(border?.bottom).toBeTruthy();
    expect(border?.left).toBeTruthy();
  });

  it("does not draw the shared edge twice on adjacent cells", () => {
    const sheet = new Sheet("s");
    new ApplyBorderCommand(host(sheet), CellRange.valueOf("A1:B2"), "all", "#000").do();
    const a1 = paintableBorder(sheet, 0, 0);
    const b1 = paintableBorder(sheet, 0, 1);
    const a2 = paintableBorder(sheet, 1, 0);
    expect(a1?.right).toBeTruthy();
    expect(a1?.bottom).toBeTruthy();
    expect(b1?.left).toBeUndefined();
    expect(a2?.top).toBeUndefined();
    expect(b1?.top).toBeTruthy();
    expect(a2?.left).toBeTruthy();
  });

  it("skips the side that a neighboring merge already owns", () => {
    const sheet = new Sheet("s");
    sheet.merge(CellRange.valueOf("A1:B2"));
    new ApplyBorderCommand(host(sheet), CellRange.valueOf("A1:C2"), "all", "#000").do();
    expect(paintableBorder(sheet, 0, 2)?.left).toBeUndefined();
    expect(paintableBorder(sheet, 0, 0)?.right).toBeTruthy();
  });
});
