import { describe, expect, it } from "vitest";
import { CellRange } from "../../src/model/CellRange";
import { Sheet } from "../../src/model/Sheet";
import { hidesHGrid, hidesVGrid } from "../../src/render/MergeGrid";

describe("MergeGrid", () => {
  it("hides interior grid of a merged block", () => {
    const sheet = new Sheet("s");
    sheet.merge(CellRange.valueOf("A1:B2"));
    expect(hidesHGrid(sheet, 0, 0, "bottom")).toBe(true);
    expect(hidesHGrid(sheet, 0, 0, "top")).toBe(false);
    expect(hidesHGrid(sheet, 1, 0, "top")).toBe(true);
    expect(hidesHGrid(sheet, 1, 0, "bottom")).toBe(false);
    expect(hidesVGrid(sheet, 0, 1)).toBe(true);
    expect(hidesVGrid(sheet, 0, 0)).toBe(false);
    expect(hidesVGrid(sheet, 0, 2)).toBe(false);
    const box = sheet.cellBox(0, 0);
    expect(box.width).toBe(sheet.cols.getWidth(0) + sheet.cols.getWidth(1));
    expect(box.height).toBe(sheet.rows.getHeight(0) + sheet.rows.getHeight(1));
  });
});
