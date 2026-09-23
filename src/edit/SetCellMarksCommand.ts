import { cloneMark, type CellMark } from "../model/CellMarks";
import type { Sheet } from "../model/Sheet";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export type CellMarkPatch = {
  sheet?: Sheet;
  ri: number;
  ci: number;
  mark?: CellMark;
};

export class SetCellMarksCommand implements EditCommand {
  readonly persistOnHistory?: boolean;
  private before: CellMarkPatch[] = [];

  constructor(
    private readonly host: EditHost,
    private readonly patches: CellMarkPatch[],
    options?: { persistOnHistory?: boolean },
  ) {
    if (options?.persistOnHistory) {
      this.persistOnHistory = true;
    }
  }

  do(): void {
    if (!this.before.length) {
      this.before = this.patches.map((item) => {
        const sheet = this.sheetOf(item);
        return {
          sheet,
          ri: item.ri,
          ci: item.ci,
          mark: cloneMark(sheet.getCellMark(item.ri, item.ci)),
        };
      });
    }
    for (const item of this.patches) {
      this.sheetOf(item).setCellMark(item.ri, item.ci, item.mark);
    }
    this.refreshTouched();
    this.host.afterChange();
  }

  undo(): void {
    for (const item of this.before) {
      this.sheetOf(item).setCellMark(item.ri, item.ci, item.mark);
    }
    this.refreshTouched();
    this.host.afterChange();
  }

  private sheetOf(item: CellMarkPatch): Sheet {
    return item.sheet ?? this.host.sheet();
  }

  private refreshTouched(): void {
    const sheets = new Set((this.before.length ? this.before : this.patches).map((item) => this.sheetOf(item)));
    for (const sheet of sheets) {
      sheet.refreshFilterView();
    }
  }
}
