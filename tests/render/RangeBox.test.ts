import { describe, expect, it } from "vitest";
import { rangeScreenBox } from "../../src/render/SheetPainter";
import { CellRange } from "../../src/model/CellRange";
import { Sheet } from "../../src/model/Sheet";
import { HEADER_HEIGHT, INDEX_WIDTH } from "../../src/shared/constants";

describe("rangeScreenBox", () => {
  it("maps A1:B2 to the grid origin", () => {
    const sheet = new Sheet("s");
    const pane = { clipX: 0, clipY: 0, clipW: 400, clipH: 300, scrollX: 0, scrollY: 0 };
    const box = rangeScreenBox(sheet, new CellRange(0, 0, 1, 1), pane);
    expect(box.x).toBe(INDEX_WIDTH);
    expect(box.y).toBe(HEADER_HEIGHT);
    expect(box.width).toBe(sheet.cols.getWidth(0) + sheet.cols.getWidth(1));
    expect(box.height).toBe(sheet.rows.getHeight(0) + sheet.rows.getHeight(1));
  });
});
