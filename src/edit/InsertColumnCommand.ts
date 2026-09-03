import { shiftSheetFormulas } from "../formula/shiftRefs";
import type { AutoFilterJson } from "../model/AutoFilter";
import type { CellRange } from "../model/CellRange";
import type { ColData } from "../model/Cols";
import type { RowData } from "../model/Rows";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class InsertColumnCommand implements EditCommand {
  private rowSnap!: Map<number, RowData>;
  private colSnap!: Map<number, ColData>;
  private mergeSnap!: CellRange[];
  private filterSnap!: AutoFilterJson;
  private freezeSnap: [number, number] = [0, 0];
  private rowLen = 0;
  private colLen = 0;

  constructor(
    private readonly host: EditHost,
    private readonly index: number,
    private readonly count: number,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.rowSnap = sheet.rows.snapshot();
    this.colSnap = sheet.cols.snapshot();
    this.mergeSnap = sheet.merges.snapshot();
    this.filterSnap = sheet.captureFilter();
    this.freezeSnap = [sheet.freeze[0], sheet.freeze[1]];
    this.rowLen = sheet.rows.len;
    this.colLen = sheet.cols.len;
    sheet.cols.insert(this.index, this.count);
    sheet.rows.shiftCells("column", this.index, this.count);
    sheet.merges.shift("column", this.index, this.count);
    sheet.autoFilter.shift("column", this.index, this.count);
    sheet.shiftFreeze("column", this.index, this.count);
    sheet.refreshFilterView();
    shiftSheetFormulas(sheet, { type: "column", index: this.index, count: this.count });
    this.host.engine().recalculate(sheet);
    this.host.afterChange();
  }

  undo(): void {
    const sheet = this.host.sheet();
    sheet.rows.restore(this.rowSnap, this.rowLen);
    sheet.cols.restore(this.colSnap, this.colLen);
    sheet.merges.restore(this.mergeSnap);
    sheet.restoreFilter(this.filterSnap);
    sheet.setFreeze(this.freezeSnap[0], this.freezeSnap[1]);
    this.host.engine().recalculate(sheet);
    this.host.afterChange();
  }
}
