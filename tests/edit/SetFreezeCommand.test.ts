import { describe, expect, it } from "vitest";
import type { EditHost } from "../../src/edit/EditHost";
import { SetFreezeCommand } from "../../src/edit/SetFreezeCommand";
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

describe("SetFreezeCommand", () => {
  it("sets and undoes freeze at the selected cell", () => {
    const sheet = new Sheet("s");
    const command = new SetFreezeCommand(host(sheet), 1, 1);
    command.do();
    expect(sheet.freeze).toEqual([1, 1]);
    command.undo();
    expect(sheet.freeze).toEqual([0, 0]);
  });
});
