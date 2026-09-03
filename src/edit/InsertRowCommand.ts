import { shiftSheetFormulas } from "../formula/shiftRefs";
import type { AutoFilterJson } from "../model/AutoFilter";
import type { CellRange } from "../model/CellRange";
import type { RowData } from "../model/Rows";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class InsertRowCommand implements EditCommand {
  private snapshot!: Map<number, RowData>;
  private mergeSnap!: CellRange[];
  private filterSnap!: AutoFilterJson;
  private freezeSnap: [number, number] = [0, 0];
  private len = 0;

  constructor(
    private readonly host: EditHost,
    private readonly index: number,
    private readonly count: number,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.snapshot = sheet.rows.snapshot();
    this.mergeSnap = sheet.merges.snapshot();
    this.filterSnap = sheet.captureFilter();
    this.freezeSnap = [sheet.freeze[0], sheet.freeze[1]];
    this.len = sheet.rows.len;
    sheet.rows.insert(this.index, this.count);
    sheet.merges.shift("row", this.index, this.count);
    sheet.autoFilter.shift("row", this.index, this.count);
    sheet.shiftFreeze("row", this.index, this.count);
    sheet.refreshFilterView();
    shiftSheetFormulas(sheet, { type: "row", index: this.index, count: this.count });
    this.host.engine().recalculate(sheet);
    this.host.afterChange();
  }

  undo(): void {
    const sheet = this.host.sheet();
    sheet.rows.restore(this.snapshot, this.len);
    sheet.merges.restore(this.mergeSnap);
    sheet.restoreFilter(this.filterSnap);
    sheet.setFreeze(this.freezeSnap[0], this.freezeSnap[1]);
    this.host.engine().recalculate(sheet);
    this.host.afterChange();
  }
}
