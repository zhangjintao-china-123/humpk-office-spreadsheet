import { cloneCell, type Cell } from "../model/Cell";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class SetCellNoteCommand implements EditCommand {
  private before: Cell | undefined;

  constructor(
    private readonly host: EditHost,
    private readonly ri: number,
    private readonly ci: number,
    private readonly note: string,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.before = cloneCell(sheet.getCell(this.ri, this.ci));
    const next = cloneCell(this.before) ?? {};
    const text = this.note.trim();
    if (text) {
      next.note = text;
    } else {
      delete next.note;
    }
    sheet.rows.setCell(this.ri, this.ci, next);
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().rows.setCell(this.ri, this.ci, cloneCell(this.before));
    this.host.afterChange();
  }
}
