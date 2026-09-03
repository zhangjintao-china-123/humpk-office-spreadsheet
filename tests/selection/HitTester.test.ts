import { describe, expect, it } from "vitest";
import { Sheet } from "../../src/model/Sheet";
import { HitTester } from "../../src/selection/HitTester";
import { HEADER_HEIGHT, INDEX_WIDTH } from "../../src/shared/constants";

describe("HitTester", () => {
  it("maps coordinates to headers and cells", () => {
    const sheet = new Sheet("s");
    const hit = new HitTester();
    expect(hit.hit(sheet, 10, 10, 0, 0)?.kind).toBe("corner");
    expect(hit.hit(sheet, INDEX_WIDTH + 10, 8, 0, 0)?.kind).toBe("col-header");
    expect(hit.hit(sheet, 8, HEADER_HEIGHT + 10, 0, 0)?.kind).toBe("row-header");
    const cell = hit.hit(sheet, INDEX_WIDTH + 10, HEADER_HEIGHT + 10, 0, 0);
    expect(cell).toMatchObject({ kind: "cell", ri: 0, ci: 0 });
  });

  it("hits the autofilter button on the header cell", () => {
    const sheet = new Sheet("s");
    sheet.autoFilter.ref = "A1:B3";
    sheet.refreshFilterView();
    const hit = new HitTester();
    const width = sheet.cols.getWidth(0);
    const height = sheet.rows.getHeight(0);
    const button = hit.hit(sheet, INDEX_WIDTH + width - 4, HEADER_HEIGHT + height - 4, 0, 0);
    expect(button).toMatchObject({ kind: "filter-button", ri: 0, ci: 0 });
    const cell = hit.hit(sheet, INDEX_WIDTH + 8, HEADER_HEIGHT + 8, 0, 0);
    expect(cell?.kind).toBe("cell");
  });

  it("accounts for scroll offset", () => {
    const sheet = new Sheet("s");
    const hit = new HitTester();
    const cell = hit.hit(sheet, INDEX_WIDTH + 10, HEADER_HEIGHT + 10, 0, sheet.rows.getHeight(0));
    expect(cell?.ri).toBe(1);
  });

  it("keeps frozen cells hit while the scroll pane moves", () => {
    const sheet = new Sheet("s");
    sheet.setFreeze(1, 1);
    const hit = new HitTester();
    const rowH = sheet.rows.getHeight(0);
    const colW = sheet.cols.getWidth(0);
    const frozen = hit.hit(sheet, INDEX_WIDTH + 8, HEADER_HEIGHT + 8, colW, rowH);
    expect(frozen).toMatchObject({ kind: "cell", ri: 0, ci: 0 });
    const scrolled = hit.hit(
      sheet,
      INDEX_WIDTH + colW + 8,
      HEADER_HEIGHT + rowH + 8,
      colW,
      rowH,
    );
    expect(scrolled).toMatchObject({ kind: "cell", ri: 2, ci: 2 });
  });
});
