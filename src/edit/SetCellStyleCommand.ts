import type { Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import type { CellStyle } from "../model/CellStyle";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";
import { asRanges, snapshotRanges } from "./rangeList";

export class SetCellStyleCommand implements EditCommand {
  private before = new Map<string, Cell | undefined>();
  private readonly ranges: CellRange[];

  constructor(
    private readonly host: EditHost,
    range: CellRange | CellRange[],
    private readonly patch: CellStyle | "clear",
  ) {
    this.ranges = asRanges(range);
  }

  do(): void {
    const sheet = this.host.sheet();
    this.before = snapshotRanges(sheet, this.ranges);
    for (const range of this.ranges) {
      if (this.patch === "clear") {
        sheet.clearStyle(range);
      } else {
        sheet.applyStylePatch(range, this.patch);
      }
    }
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().restoreCells(this.before);
    this.host.afterChange();
  }
}
