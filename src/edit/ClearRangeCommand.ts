import { cloneCell, type Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class ClearRangeCommand implements EditCommand {
  private before = new Map<string, Cell | undefined>();

  constructor(
    private readonly host: EditHost,
    private readonly range: CellRange,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.before = sheet.snapshotCells(this.range);
    this.range.each((ri, ci) => {
      const cell = cloneCell(sheet.getCell(ri, ci));
      if (!cell) {
        return;
      }
      delete cell.text;
      delete cell.value;
      sheet.rows.setCell(ri, ci, cell);
    });
    this.host.engine().recalculate(sheet);
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().restoreCells(this.before);
    this.host.engine().recalculate(this.host.sheet());
    this.host.afterChange();
  }
}
