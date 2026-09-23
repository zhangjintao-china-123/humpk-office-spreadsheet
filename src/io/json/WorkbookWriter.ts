import { cloneStyle } from "../../model/CellStyle";
import type { Sheet } from "../../model/Sheet";
import type { SheetJson, WorkbookJson } from "../../model/SheetJson";
import type { Workbook } from "../../model/Workbook";
import { xy2expr } from "../../shared/alphabet";

export class WorkbookWriter {
  write(book: Workbook): WorkbookJson {
    return book.sheets.map((sheet) => this.writeSheet(sheet));
  }

  writeSheet(sheet: Sheet): SheetJson {
    return {
      name: sheet.name,
      table: sheet.table,
      filters: sheet.filters,
      styles: sheet.styles.map((style) => cloneStyle(style)),
      merges: sheet.merges.getData(),
      cols: sheet.cols.getData(),
      rows: sheet.rows.getData(),
      uploadimages: sheet.images.getData(),
      autofilter: sheet.autoFilter.getData(),
      freeze: xy2expr(sheet.freeze[1], sheet.freeze[0]),
      checkmarks: sheet.listCheckmarks().map((item) => xy2expr(item.ci, item.ri)),
      editables: sheet.listEditableCells().map((item) => xy2expr(item.ci, item.ri)),
      cellControls: sheet.listCellControls().map((item) => ({
        ref: xy2expr(item.ci, item.ri),
        kind: item.control.kind,
        ...(item.control.kind === "dropdown" ? { options: item.control.options } : {}),
      })),
      cellMarks: sheet.listCellMarks().map((item) => ({
        ref: xy2expr(item.ci, item.ri),
        ...(item.mark.priority ? { priority: item.mark.priority } : {}),
        ...(item.mark.shape ? { shape: item.mark.shape } : {}),
        ...(item.mark.verdict ? { verdict: item.mark.verdict } : {}),
      })),
    };
  }
}
