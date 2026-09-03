import { cloneCell, type Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class PasteCommand implements EditCommand {
  private before = new Map<string, Cell | undefined>();

  constructor(
    private readonly host: EditHost,
    private readonly originRi: number,
    private readonly originCi: number,
    private readonly grid: Array<Array<Cell | undefined>>,
    private readonly range: CellRange,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.before = sheet.snapshotCells(this.range);
    for (let r = 0; r < this.grid.length; r += 1) {
      const row = this.grid[r];
      for (let c = 0; c < row.length; c += 1) {
        sheet.rows.setCell(this.originRi + r, this.originCi + c, cloneCell(row[c]));
      }
    }
    this.host.engine().recalculate(sheet);
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().restoreCells(this.before);
    this.host.engine().recalculate(this.host.sheet());
    this.host.afterChange();
  }
}
