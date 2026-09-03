import { describe, expect, it } from "vitest";
import { ApplyBorderCommand } from "../../src/edit/ApplyBorderCommand";
import type { EditHost } from "../../src/edit/EditHost";
import { FormulaEngine } from "../../src/formula/FormulaEngine";
import { CellRange } from "../../src/model/CellRange";
import { Sheet } from "../../src/model/Sheet";
import { visibleBorder } from "../../src/render/MergeBorder";

function host(sheet: Sheet): EditHost {
  const engine = new FormulaEngine();
  return {
    sheet: () => sheet,
    engine: () => engine,
    afterChange() {},
  };
}

describe("ApplyBorderCommand", () => {
  it("puts all four sides on a single cell", () => {
    const sheet = new Sheet("s");
    new ApplyBorderCommand(host(sheet), CellRange.cell(0, 0), "all", "#111111").do();
    const border = sheet.getCellStyle(0, 0).border;
    expect(border?.top?.[1]).toBe("#111111");
    expect(border?.right?.[1]).toBe("#111111");
    expect(border?.bottom?.[1]).toBe("#111111");
    expect(border?.left?.[1]).toBe("#111111");
  });

  it("draws outside of a merged block on every outer edge", () => {
    const sheet = new Sheet("s");
    sheet.merge(CellRange.valueOf("A1:B2"));
    new ApplyBorderCommand(host(sheet), CellRange.valueOf("A1:B2"), "outside", "#000000").do();
    const border = visibleBorder(sheet, 0, 0);
    expect(border?.top).toBeTruthy();
    expect(border?.right).toBeTruthy();
    expect(border?.bottom).toBeTruthy();
    expect(border?.left).toBeTruthy();
  });

  it("clears borders", () => {
    const sheet = new Sheet("s");
    const h = host(sheet);
    new ApplyBorderCommand(h, CellRange.cell(0, 0), "all", "#000").do();
    new ApplyBorderCommand(h, CellRange.cell(0, 0), "none", "#000").do();
    expect(sheet.getCellStyle(0, 0).border).toBeUndefined();
  });
});
