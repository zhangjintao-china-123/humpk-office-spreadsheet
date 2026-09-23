import { expandFilterRange, type AutoFilterJson } from "../model/AutoFilter";
import { cellDisplay, cellNoteText } from "../model/Cell";
import { isEmptyMark } from "../model/CellMarks";
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
      const was = sheet.autoFilter.range().clone();
      sheet.alignAutoFilterHeader();
      if (sheet.autoFilter.range().equals(was)) {
        sheet.autoFilter.clear();
      }
    } else {
      const expanded = expandFilterRange(
        this.range,
        sheet.rows.len,
        sheet.cols.len,
        (ri, ci) => {
          if (cellDisplay(sheet.getCell(ri, ci), sheet.getCellStyle(ri, ci))) {
            return true;
          }
          if (cellNoteText(sheet.getCell(ri, ci))) {
            return true;
          }
          if (sheet.getCellVerdict(ri, ci) !== "none") {
            return true;
          }
          return !isEmptyMark(sheet.getCellMark(ri, ci));
        },
        (ri, ci) => sheet.merges.getFirstIncludes(ri, ci),
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
