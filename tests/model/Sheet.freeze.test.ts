import { describe, expect, it } from "vitest";
import { Sheet } from "../../src/model/Sheet";
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from "../../src/shared/constants";

describe("Sheet freeze", () => {
  it("treats A1 as inactive", () => {
    const sheet = new Sheet("s");
    expect(sheet.freezeIsActive()).toBe(false);
    expect(sheet.freezeTotalWidth()).toBe(0);
    expect(sheet.freezeTotalHeight()).toBe(0);
  });

  it("freezes rows above and columns left of the selected cell", () => {
    const sheet = new Sheet("s");
    sheet.setFreeze(2, 1);
    expect(sheet.freezeIsActive()).toBe(true);
    expect(sheet.freezeTotalWidth()).toBe(DEFAULT_COL_WIDTH);
    expect(sheet.freezeTotalHeight()).toBe(DEFAULT_ROW_HEIGHT * 2);
  });

  it("shifts freeze when inserting or deleting before the line", () => {
    const sheet = new Sheet("s");
    sheet.setFreeze(2, 2);
    sheet.shiftFreeze("row", 0, 1);
    expect(sheet.freeze).toEqual([3, 2]);
    sheet.shiftFreeze("column", 1, -1);
    expect(sheet.freeze).toEqual([3, 1]);
    sheet.shiftFreeze("row", 3, 1);
    expect(sheet.freeze).toEqual([3, 1]);
  });
});
