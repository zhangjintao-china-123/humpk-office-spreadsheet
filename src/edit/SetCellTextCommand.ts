import { cloneCell, type Cell } from "../model/Cell";
import { parseTypedInput, writeParsedInput } from "../model/InputParse";
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
    const parsed = parseTypedInput(this.text, sheet.getCellStyle(this.ri, this.ci).numFmt);
    writeParsedInput(sheet, this.ri, this.ci, parsed);
    this.host.engine().recalculateAt([{ sheet, ri: this.ri, ci: this.ci }]);
    this.host.afterChange();
  }

  undo(): void {
    const sheet = this.host.sheet();
    sheet.rows.setCell(this.ri, this.ci, cloneCell(this.before));
    this.host.engine().recalculateAt([{ sheet, ri: this.ri, ci: this.ci }]);
    this.host.afterChange();
  }
}
