import { cloneCell, type Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import { parseTypedInput, writeParsedInput } from "../model/InputParse";
import { originsFromRange } from "./ClearRangeCommand";
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
        const ri = this.originRi + r;
        const ci = this.originCi + c;
        const incoming = row[c];
        if (incoming && incoming.style === undefined && incoming.value === undefined && incoming.text) {
          const parsed = parseTypedInput(incoming.text, sheet.getCellStyle(ri, ci).numFmt);
          writeParsedInput(sheet, ri, ci, parsed);
        } else {
          sheet.rows.setCell(ri, ci, cloneCell(incoming));
        }
      }
    }
    sheet.growRowsToFit(this.range);
    this.host.engine().recalculateAt(originsFromRange(sheet, this.range));
    this.host.afterChange();
  }

  undo(): void {
    const sheet = this.host.sheet();
    sheet.restoreCells(this.before);
    this.host.engine().recalculateAt(originsFromRange(sheet, this.range));
    this.host.afterChange();
  }
}
