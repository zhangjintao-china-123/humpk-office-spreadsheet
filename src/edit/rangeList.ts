import type { Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import type { Sheet } from "../model/Sheet";

export function asRanges(range: CellRange | CellRange[]): CellRange[] {
  return (Array.isArray(range) ? range : [range]).map((item) => item.clone());
}

export function snapshotRanges(sheet: Sheet, ranges: CellRange[]): Map<string, Cell | undefined> {
  const before = new Map<string, Cell | undefined>();
  for (const range of ranges) {
    for (const [key, cell] of sheet.snapshotCells(range)) {
      if (!before.has(key)) {
        before.set(key, cell);
      }
    }
  }
  return before;
}
