import { cloneCell, type Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import type { RecalcOrigin } from "../formula/FormulaEngine";
import type { Sheet } from "../model/Sheet";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";
import { asRanges, snapshotRanges } from "./rangeList";

export function originsFromRange(sheet: Sheet, range: CellRange): RecalcOrigin[] {
  return originsFromRanges(sheet, [range]);
}

export function originsFromRanges(sheet: Sheet, ranges: CellRange[]): RecalcOrigin[] {
  const origins: RecalcOrigin[] = [];
  const seen = new Set<string>();
  for (const range of ranges) {
    range.each((ri, ci) => {
      const key = `${ri},${ci}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      origins.push({ sheet, ri, ci });
    });
  }
  return origins;
}

export class ClearRangeCommand implements EditCommand {
  private before = new Map<string, Cell | undefined>();
  private readonly ranges: CellRange[];

  constructor(
    private readonly host: EditHost,
    range: CellRange | CellRange[],
  ) {
    this.ranges = asRanges(range);
  }

  do(): void {
    const sheet = this.host.sheet();
    this.before = snapshotRanges(sheet, this.ranges);
    for (const range of this.ranges) {
      range.each((ri, ci) => {
        const cell = cloneCell(sheet.getCell(ri, ci));
        if (!cell) {
          return;
        }
        delete cell.text;
        delete cell.value;
        sheet.rows.setCell(ri, ci, cell);
      });
    }
    this.host.engine().recalculateAt(originsFromRanges(sheet, this.ranges));
    this.host.afterChange();
  }

  undo(): void {
    const sheet = this.host.sheet();
    sheet.restoreCells(this.before);
    this.host.engine().recalculateAt(originsFromRanges(sheet, this.ranges));
    this.host.afterChange();
  }
}
