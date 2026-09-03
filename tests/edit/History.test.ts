import { describe, expect, it } from "vitest";
import type { EditHost } from "../../src/edit/EditHost";
import { History } from "../../src/edit/History";
import { SetCellTextCommand } from "../../src/edit/SetCellTextCommand";
import { FormulaEngine } from "../../src/formula/FormulaEngine";
import { Sheet } from "../../src/model/Sheet";

function host(sheet: Sheet): EditHost {
  const engine = new FormulaEngine();
  return {
    sheet: () => sheet,
    engine: () => engine,
    afterChange() {},
  };
}

describe("history", () => {
  it("undoes and redoes cell text", () => {
    const sheet = new Sheet("s");
    const h = host(sheet);
    const history = new History();
    history.do(new SetCellTextCommand(h, 0, 0, "hello"));
    expect(sheet.getCell(0, 0)?.text).toBe("hello");
    history.undo();
    expect(sheet.getCell(0, 0)?.text).toBeUndefined();
    history.redo();
    expect(sheet.getCell(0, 0)?.text).toBe("hello");
  });
});
