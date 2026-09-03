import type { Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class MergeCommand implements EditCommand {
  private before = new Map<string, Cell | undefined>();
  private mergeSnap: CellRange[] = [];

  constructor(
    private readonly host: EditHost,
    range: CellRange,
  ) {
    this.range = range.clone();
  }

  private readonly range: CellRange;

  do(): void {
    const sheet = this.host.sheet();
    this.mergeSnap = sheet.merges.snapshot();
    this.before = sheet.snapshotCells(this.range);
    sheet.merge(this.range);
    this.host.afterChange();
  }

  undo(): void {
    const sheet = this.host.sheet();
    sheet.merges.restore(this.mergeSnap);
    sheet.restoreCells(this.before);
    this.host.afterChange();
  }
}
