import { describe, expect, it } from "vitest";
import { Sheet } from "../../src/model/Sheet";
import { CellNavigator } from "../../src/selection/CellNavigator";
import { Selection } from "../../src/selection/Selection";

describe("CellNavigator", () => {
  it("jumps across empty cells to the next value", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "a");
    sheet.rows.setCellText(0, 4, "b");
    expect(CellNavigator.edge(sheet, 0, 0, 0, 1)).toEqual({ ri: 0, ci: 4 });
    expect(CellNavigator.edge(sheet, 0, 4, 0, -1)).toEqual({ ri: 0, ci: 0 });
  });

  it("stops at the last filled cell in a block", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "a");
    sheet.rows.setCellText(0, 1, "b");
    sheet.rows.setCellText(0, 2, "c");
    expect(CellNavigator.edge(sheet, 0, 0, 0, 1)).toEqual({ ri: 0, ci: 2 });
  });

  it("finds the last used cell", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(2, 3, "x");
    expect(CellNavigator.lastUsed(sheet)).toEqual({ ri: 2, ci: 3 });
    expect(CellNavigator.lastUsedInRow(sheet, 2)).toBe(3);
  });
});

describe("Selection", () => {
  it("keeps the anchor when extending", () => {
    const sheet = new Sheet("s");
    const selection = new Selection();
    selection.set(2, 2, sheet);
    selection.extend(0, -2, sheet);
    expect(selection.ri).toBe(2);
    expect(selection.ci).toBe(2);
    expect(selection.focusCi).toBe(0);
    expect(selection.range.toString()).toBe("A3:C3");
  });

  it("jumps with ctrl-style navigation", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "a");
    sheet.rows.setCellText(5, 0, "z");
    const selection = new Selection();
    selection.set(0, 0, sheet);
    selection.jump(1, 0, sheet);
    expect(selection.ri).toBe(5);
  });
});
