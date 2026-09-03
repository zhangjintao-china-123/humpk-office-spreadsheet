import { describe, expect, it } from "vitest";
import { Clipboard } from "../../src/edit/Clipboard";
import { CellRange } from "../../src/model/CellRange";
import { Sheet } from "../../src/model/Sheet";

describe("clipboard", () => {
  it("keeps the source sheet and range after copy", () => {
    const sheet = new Sheet("s");
    sheet.rows.setCellText(0, 0, "1");
    const clipboard = new Clipboard();
    const range = new CellRange(0, 0, 1, 1);
    clipboard.copy(sheet, range, "copy");
    expect(clipboard.payload?.sheet).toBe(sheet);
    expect(clipboard.payload?.range.toString()).toBe("A1:B2");
    expect(clipboard.payload?.mode).toBe("copy");
  });

  it("clears the marching box payload", () => {
    const sheet = new Sheet("s");
    const clipboard = new Clipboard();
    clipboard.copy(sheet, new CellRange(0, 0, 0, 0));
    clipboard.clear();
    expect(clipboard.payload).toBeNull();
  });
});
