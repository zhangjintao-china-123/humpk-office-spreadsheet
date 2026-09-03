import { describe, expect, it } from "vitest";
import { Rows } from "../../src/model/Rows";
import { Cols } from "../../src/model/Cols";

describe("sparse rows and cols", () => {
  it("stores cells sparsely", () => {
    const rows = new Rows();
    rows.setCellText(2, 3, "hello");
    expect(rows.getCell(2, 3)?.text).toBe("hello");
    expect(rows.getCell(0, 0)).toBeUndefined();
  });

  it("inserts and removes rows", () => {
    const rows = new Rows();
    rows.setCellText(1, 0, "a");
    rows.insert(1, 2);
    expect(rows.getCell(3, 0)?.text).toBe("a");
    expect(rows.getCell(1, 0)).toBeUndefined();
    rows.remove(1, 2);
    expect(rows.getCell(1, 0)?.text).toBe("a");
  });

  it("shifts cells when inserting columns", () => {
    const rows = new Rows();
    rows.setCellText(0, 1, "b");
    rows.shiftCells("column", 1, 1);
    expect(rows.getCell(0, 2)?.text).toBe("b");
    expect(rows.getCell(0, 1)).toBeUndefined();
  });

  it("keeps custom widths", () => {
    const cols = new Cols();
    cols.setWidth(2, 120);
    expect(cols.getWidth(2)).toBe(120);
    expect(cols.getWidth(0)).toBe(cols.width);
  });
});
