import { expandFilterRange, type AutoFilterJson } from "../model/AutoFilter";
import { cellDisplay } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class ToggleAutoFilterCommand implements EditCommand {
  private before: AutoFilterJson = {};

  constructor(
    private readonly host: EditHost,
    private readonly range: CellRange,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.before = sheet.captureFilter();
    if (sheet.autoFilter.active()) {
      sheet.autoFilter.clear();
    } else {
      const expanded = expandFilterRange(
        this.range,
        sheet.rows.len,
        sheet.cols.len,
        (ri, ci) => cellDisplay(sheet.getCell(ri, ci)),
      );
      sheet.autoFilter.ref = expanded.toString();
      sheet.autoFilter.filters = [];
      sheet.autoFilter.sort = null;
    }
    sheet.refreshFilterView();
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().restoreFilter(this.before);
    this.host.afterChange();
  }
}
