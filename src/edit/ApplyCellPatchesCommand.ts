import { cloneCell, type Cell } from "../model/Cell";
import { parseTypedInput, writeParsedInput } from "../model/InputParse";
import type { Sheet } from "../model/Sheet";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export type CellPatchTarget = {
  sheet: Sheet;
  ri: number;
  ci: number;
  text: string;
};

type AppliedOrigin = CellPatchTarget & { before: Cell | undefined };

export class ApplyCellPatchesCommand implements EditCommand {
  readonly persistOnHistory = true;
  private origins: AppliedOrigin[] | undefined;

  constructor(
    private readonly host: EditHost,
    private readonly targets: CellPatchTarget[],
  ) {}

  do(): void {
    if (!this.origins) {
      this.origins = this.targets.map((target) => ({
        ...target,
        before: cloneCell(target.sheet.getCell(target.ri, target.ci)),
      }));
    }
    for (const item of this.origins) {
      const parsed = parseTypedInput(item.text, item.sheet.getCellStyle(item.ri, item.ci).numFmt);
      writeParsedInput(item.sheet, item.ri, item.ci, parsed);
    }
    this.host.engine().recalculateAt(this.origins);
    this.host.afterChange();
  }

  undo(): void {
    if (!this.origins) return;
    for (const item of this.origins) {
      item.sheet.rows.setCell(item.ri, item.ci, cloneCell(item.before));
    }
    this.host.engine().recalculateAt(this.origins);
    this.host.afterChange();
  }
}
