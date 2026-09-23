import { cloneCell, type Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import type { FillAxis } from "../selection/FillHandle";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";
import { originsFromRange } from "./ClearRangeCommand";
import { filledCell } from "./fillSeries";

export class FillCommand implements EditCommand {
  private before = new Map<string, Cell | undefined>();
  private rowLen = 0;
  private colLen = 0;

  constructor(
    private readonly host: EditHost,
    private readonly source: CellRange,
    private readonly dest: CellRange,
    private readonly axis: FillAxis,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.rowLen = sheet.rows.len;
    this.colLen = sheet.cols.len;
    sheet.rows.len = Math.max(sheet.rows.len, this.dest.eri + 1);
    sheet.cols.len = Math.max(sheet.cols.len, this.dest.eci + 1);
    this.before = sheet.snapshotCells(this.dest);
    this.dest.each((ri, ci) => {
      if (this.source.includes(ri, ci)) {
        return;
      }
      sheet.rows.setCell(ri, ci, cloneCell(filledCell(sheet, this.source, ri, ci, this.axis)));
    });
    this.host.engine().recalculateAt(originsFromRange(sheet, this.dest));
    this.host.afterChange();
  }

  undo(): void {
    const sheet = this.host.sheet();
    sheet.restoreCells(this.before);
    sheet.rows.len = this.rowLen;
    sheet.cols.len = this.colLen;
    this.host.engine().recalculateAt(originsFromRange(sheet, this.dest));
    this.host.afterChange();
  }
}
