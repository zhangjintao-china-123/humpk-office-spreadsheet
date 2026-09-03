import { describe, expect, it } from "vitest";
import { CellRange } from "../../src/model/CellRange";

describe("CellRange", () => {
  it("parses refs and normalizes order", () => {
    const range = CellRange.valueOf("B2:A1");
    expect(range.sri).toBe(0);
    expect(range.sci).toBe(0);
    expect(range.eri).toBe(1);
    expect(range.eci).toBe(1);
    expect(range.toString()).toBe("A1:B2");
  });

  it("tests include and intersect", () => {
    const a = CellRange.valueOf("A1:C3");
    expect(a.includes(1, 1)).toBe(true);
    expect(a.intersects(CellRange.valueOf("C3:D4"))).toBe(true);
    expect(a.intersects(CellRange.valueOf("E5"))).toBe(false);
  });
});
