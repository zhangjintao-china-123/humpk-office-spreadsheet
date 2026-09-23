import { describe, expect, it } from "vitest";
import { CellRange } from "../../src/model/CellRange";
import { applyPointRef, rewriteFormulaRef } from "../../src/formula/formulaEdit";
import { scanFormulaRefs } from "../../src/formula/formulaRefs";

describe("formulaRefs", () => {
  it("scan A1+B2 on current sheet", () => {
    const refs = scanFormulaRefs("=A1+B2", "Sheet1");
    expect(refs.length).toBe(2);
    expect(refs[0].range.toString()).toBe("A1");
    expect(refs[1].range.toString()).toBe("B2");
    expect(refs[0].sameSheet).toBe(true);
  });

  it("scan SUM range", () => {
    const refs = scanFormulaRefs("=SUM(C5:C17)", "Sheet1");
    expect(refs.length).toBe(1);
    expect(refs[0].range.toString()).toBe("C5:C17");
    expect(refs[0].start).toBe(5);
    expect(refs[0].end).toBe(11);
  });

  it("keeps $ flags", () => {
    const refs = scanFormulaRefs("=$C$5:C$17", "Sheet1");
    expect(refs[0].startAbs).toEqual({ col: true, row: true });
    expect(refs[0].endAbs).toEqual({ col: false, row: true });
  });

  it("skips bare tokens inside name= strings", () => {
    const refs = scanFormulaRefs("=SUMACROSS(\"'资产负债表'!C5\", \"name=A1\")", "Sheet1");
    expect(refs.length).toBe(1);
    expect(refs[0].sheet).toBe("资产负债表");
    expect(refs[0].range.toString()).toBe("C5");
    expect(refs[0].sameSheet).toBe(false);
  });

  it("highlights same-sheet ref inside SUMACROSS string", () => {
    const refs = scanFormulaRefs("=SUMACROSS(\"'Sheet1'!C5:C17\", \"name=资产负债表\")", "Sheet1");
    expect(refs.length).toBe(1);
    expect(refs[0].sameSheet).toBe(true);
    expect(refs[0].range.toString()).toBe("C5:C17");
  });

  it("incomplete formula still highlights finished refs", () => {
    const refs = scanFormulaRefs("=SUM(A1,", "Sheet1");
    expect(refs.length).toBe(1);
    expect(refs[0].raw).toBe("A1");
  });

  it("cross-sheet ref is not sameSheet", () => {
    const refs = scanFormulaRefs("='资产负债表'!C5+A1", "Sheet1");
    expect(refs.length).toBe(2);
    expect(refs[0].sameSheet).toBe(false);
    expect(refs[0].sheet).toBe("资产负债表");
    expect(refs[1].sameSheet).toBe(true);
  });

  it("point click inserts after equals", () => {
    const next = applyPointRef(
      { source: "bar", mode: "edit", anchorRi: 0, anchorCi: 0, text: "=", cursor: 1 },
      CellRange.cell(4, 2),
      "Sheet1",
    );
    expect(next.text).toBe("=C5");
    expect(next.mode).toBe("point");
  });

  it("second click replaces the active ref", () => {
    const first = applyPointRef(
      { source: "bar", mode: "point", anchorRi: 0, anchorCi: 0, text: "=", cursor: 1 },
      CellRange.cell(4, 2),
      "Sheet1",
    );
    const second = applyPointRef(first, new CellRange(7, 3, 9, 3), "Sheet1");
    expect(second.text).toBe("=D8:D10");
  });

  it("rewrite keeps dollar style", () => {
    const refs = scanFormulaRefs("=SUM($C$5:C$17)", "Sheet1");
    const next = rewriteFormulaRef("=SUM($C$5:C$17)", refs[0], new CellRange(4, 2, 19, 3));
    expect(next.text).toBe("=SUM($C$5:D$20)");
  });
});
