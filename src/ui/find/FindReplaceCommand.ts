import { cloneCell, type Cell } from "../../model/Cell";
import { parseTypedInput, writeParsedInput } from "../../model/InputParse";
import type { Sheet } from "../../model/Sheet";
import type { EditCommand } from "../../edit/EditCommand";
import type { EditHost } from "../../edit/EditHost";
import type { FindLookIn } from "./sheetFind";

export type FindReplaceTarget = {
  sheet: Sheet;
  ri: number;
  ci: number;
  next: string;
};

type Applied = FindReplaceTarget & { before: Cell | undefined };

export class ApplyFindReplaceCommand implements EditCommand {
  readonly persistOnHistory = true;
  private origins: Applied[] | undefined;

  constructor(
    private readonly host: EditHost,
    private readonly targets: FindReplaceTarget[],
    private readonly lookIn: FindLookIn,
  ) {}

  do(): void {
    if (!this.origins) {
      this.origins = this.targets.map((target) => ({
        ...target,
        before: cloneCell(target.sheet.getCell(target.ri, target.ci)),
      }));
    }
    for (const item of this.origins) {
      if (this.lookIn === "comments") {
        writeNote(item.sheet, item.ri, item.ci, item.next);
      } else {
        const parsed = parseTypedInput(item.next, item.sheet.getCellStyle(item.ri, item.ci).numFmt);
        writeParsedInput(item.sheet, item.ri, item.ci, parsed);
      }
    }
    this.host.engine().recalculateAt(this.origins);
    this.host.afterChange();
  }

  undo(): void {
    if (!this.origins) {
      return;
    }
    for (const item of this.origins) {
      item.sheet.rows.setCell(item.ri, item.ci, cloneCell(item.before));
    }
    this.host.engine().recalculateAt(this.origins);
    this.host.afterChange();
  }
}

function writeNote(sheet: Sheet, ri: number, ci: number, note: string): void {
  const next = cloneCell(sheet.getCell(ri, ci)) ?? {};
  const text = note.trim();
  if (text) {
    next.note = text;
  } else {
    delete next.note;
  }
  sheet.rows.setCell(ri, ci, next);
}
