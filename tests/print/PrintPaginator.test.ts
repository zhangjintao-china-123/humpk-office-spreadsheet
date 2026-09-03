import { describe, expect, it } from "vitest";
import { Sheet } from "../../src/model/Sheet";
import { columnBands, paginateSheet } from "../../src/print/PrintPaginator";
import { PrintSetup } from "../../src/print/PrintSetup";

describe("PrintPaginator", () => {
  it("prints one blank page when the sheet is empty", () => {
    const pages = paginateSheet(new Sheet("s"), new PrintSetup());
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ sri: 0, sci: 0, eri: 0, eci: 0 });
  });

  it("keeps an oversized column on its own band", () => {
    const sheet = new Sheet("s");
    sheet.cols.setWidth(0, 400);
    sheet.cols.setWidth(1, 80);
    const bands = columnBands(sheet, 0, 1, 200);
    expect(bands).toEqual([
      { sci: 0, eci: 0 },
      { sci: 1, eci: 1 },
    ]);
  });

  it("includes the last column of the used range", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 5, "end");
    const setup = new PrintSetup();
    setup.marginX = 30;
    const pages = paginateSheet(sheet, setup);
    expect(pages[pages.length - 1].eci).toBe(5);
  });

  it("fits more columns when scale is smaller", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 20, "z");
    const full = new PrintSetup();
    full.scale = 1;
    const half = new PrintSetup();
    half.scale = 0.5;
    expect(paginateSheet(sheet, half).length).toBeLessThan(paginateSheet(sheet, full).length);
  });
});
