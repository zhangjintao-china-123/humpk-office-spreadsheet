import { cloneCell, type Cell } from "../model/Cell";
import { CellRange } from "../model/CellRange";
import { cloneStyle, type CellStyle } from "../model/CellStyle";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export function paintDestRange(srcRows: number, srcCols: number, dest: CellRange, maxRows: number, maxCols: number): CellRange {
  const outR = Math.ceil(Math.max(dest.rowCount(), srcRows) / srcRows) * srcRows;
  const outC = Math.ceil(Math.max(dest.colCount(), srcCols) / srcCols) * srcCols;
  return new CellRange(
    dest.sri,
    dest.sci,
    Math.min(dest.sri + outR - 1, maxRows - 1),
    Math.min(dest.sci + outC - 1, maxCols - 1),
  );
}

export class PaintFormatCommand implements EditCommand {
  private before = new Map<string, Cell | undefined>();
  private applied = new CellRange(0, 0, 0, 0);

  constructor(
    private readonly host: EditHost,
    private readonly dest: CellRange,
    private readonly styles: Array<Array<CellStyle | undefined>>,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    const rn = this.styles.length;
    const cn = Math.max(0, ...this.styles.map((row) => row.length));
    if (rn === 0 || cn === 0) {
      return;
    }
    this.applied = paintDestRange(rn, cn, this.dest, sheet.rows.len, sheet.cols.len);
    this.before = sheet.snapshotCells(this.applied);
    this.applied.each((ri, ci) => {
      const style = this.styles[(ri - this.applied.sri) % rn]?.[(ci - this.applied.sci) % cn];
      if (style === undefined) {
        const cell = cloneCell(sheet.getCell(ri, ci));
        if (cell) {
          delete cell.style;
          sheet.rows.setCell(ri, ci, cell);
        }
        return;
      }
      const cell = sheet.rows.getCellOrNew(ri, ci);
      cell.style = sheet.addStyle(cloneStyle(style));
    });
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().restoreCells(this.before);
    this.host.afterChange();
  }
}
