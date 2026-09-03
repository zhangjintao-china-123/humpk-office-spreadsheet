import { describe, expect, it } from "vitest";
import { expr2xy, indexAt, stringAt, xy2expr } from "../../src/shared/alphabet";

describe("alphabet", () => {
  it("maps column index to letters", () => {
    expect(stringAt(0)).toBe("A");
    expect(stringAt(25)).toBe("Z");
    expect(stringAt(26)).toBe("AA");
    expect(stringAt(27)).toBe("AB");
  });

  it("maps letters to column index", () => {
    expect(indexAt("A")).toBe(0);
    expect(indexAt("Z")).toBe(25);
    expect(indexAt("AA")).toBe(26);
  });

  it("converts A1 tags", () => {
    expect(expr2xy("B10")).toEqual([1, 9]);
    expect(xy2expr(1, 9)).toBe("B10");
  });
});
