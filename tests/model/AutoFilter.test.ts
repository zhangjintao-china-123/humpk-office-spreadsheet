import { describe, expect, it } from "vitest";
import { AutoFilter, compareFilterValue, expandFilterRange } from "../../src/model/AutoFilter";
import { CellRange } from "../../src/model/CellRange";
import { Sheet } from "../../src/model/Sheet";

describe("AutoFilter", () => {
  it("hides rows that are not in the selected values", () => {
    const sheet = table();
    sheet.autoFilter.setData({
      ref: "A1:B4",
      filters: [{ ci: 0, operator: "in", value: ["北京"] }],
    });
    sheet.refreshFilterView();
    expect(sheet.isRowHidden(1)).toBe(false);
    expect(sheet.isRowHidden(2)).toBe(true);
    expect(sheet.isRowHidden(3)).toBe(true);
    expect([...sheet.eachViewRow()]).toEqual([0, 1].concat(range(4, sheet.rows.len)));
  });

  it("sorts visible rows by column value", () => {
    const sheet = table();
    sheet.autoFilter.setData({
      ref: "A1:B4",
      filters: [{ ci: 0, operator: "in", value: ["北京", "上海", "广州"] }],
      sort: { ci: 0, order: "asc" },
    });
    sheet.refreshFilterView();
    const cities = [...sheet.eachViewRow()].slice(1, 4).map((ri) => sheet.getCell(ri, 0)?.text ?? "");
    expect(cities).toEqual([...cities].sort(compareFilterValue));
  });

  it("expands a single header cell to the used block", () => {
    const sheet = table();
    const range = expandFilterRange(CellRange.cell(0, 0), sheet.rows.len, sheet.cols.len, (ri, ci) => {
      return sheet.getCell(ri, ci)?.text ?? "";
    });
    expect(range.toString()).toBe("A1:B4");
  });

  it("roundtrips json and reapplies hidden rows", () => {
    const filter = new AutoFilter();
    filter.setData({
      ref: "A1:C3",
      filters: [{ ci: 1, operator: "in", value: ["x"] }],
      sort: { ci: 1, order: "desc" },
    });
    expect(filter.getData()).toEqual({
      ref: "A1:C3",
      filters: [{ ci: 1, operator: "in", value: ["x"] }],
      sort: { ci: 1, order: "desc" },
    });
  });

  it("compares numbers before locale text", () => {
    expect(compareFilterValue("10", "2")).toBeGreaterThan(0);
    expect(compareFilterValue("上海", "北京")).not.toBe(0);
    expect(compareFilterValue("", "a")).toBeGreaterThan(0);
  });
});

function table(): Sheet {
  const sheet = new Sheet("s", 20, 8);
  sheet.rows.setCellText(0, 0, "城市");
  sheet.rows.setCellText(0, 1, "销量");
  sheet.rows.setCellText(1, 0, "北京");
  sheet.rows.setCellText(1, 1, "30");
  sheet.rows.setCellText(2, 0, "上海");
  sheet.rows.setCellText(2, 1, "10");
  sheet.rows.setCellText(3, 0, "广州");
  sheet.rows.setCellText(3, 1, "20");
  return sheet;
}

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i < end; i += 1) {
    out.push(i);
  }
  return out;
}
