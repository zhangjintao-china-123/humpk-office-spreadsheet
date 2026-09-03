import type { Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import type { CellStyle } from "../model/CellStyle";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class SetCellStyleCommand implements EditCommand {
  private before = new Map<string, Cell | undefined>();

  constructor(
    private readonly host: EditHost,
    private readonly range: CellRange,
    private readonly patch: CellStyle | "clear",
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.before = this.patch === "clear"
      ? sheet.clearStyle(this.range)
      : sheet.applyStylePatch(this.range, this.patch);
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().restoreCells(this.before);
    this.host.afterChange();
  }
}
