import { describe, expect, it } from "vitest";
import { CellRange } from "../../src/model/CellRange";
import { Sheet } from "../../src/model/Sheet";

describe("Sheet.usedRange", () => {
  it("returns undefined for a blank sheet", () => {
    expect(new Sheet("s").usedRange()).toBeUndefined();
  });

  it("spans from A1 to the farthest occupied cell", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(2, 3, "x");
    expect(sheet.usedRange()?.toString()).toBe("A1:D3");
  });

  it("includes merge extents", () => {
    const sheet = new Sheet("s");
    sheet.merge(CellRange.valueOf("B2:E6"));
    expect(sheet.usedRange()?.toString()).toBe("A1:E6");
  });
});
