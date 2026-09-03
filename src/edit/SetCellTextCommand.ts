import { cloneCell, type Cell } from "../model/Cell";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class SetCellTextCommand implements EditCommand {
  private before: Cell | undefined;

  constructor(
    private readonly host: EditHost,
    private readonly ri: number,
    private readonly ci: number,
    private readonly text: string,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.before = cloneCell(sheet.getCell(this.ri, this.ci));
    sheet.rows.setCellText(this.ri, this.ci, this.text);
    this.host.engine().recalculate(sheet);
    this.host.afterChange();
  }

  undo(): void {
    const sheet = this.host.sheet();
    sheet.rows.setCell(this.ri, this.ci, cloneCell(this.before));
    this.host.engine().recalculate(sheet);
    this.host.afterChange();
  }
}
