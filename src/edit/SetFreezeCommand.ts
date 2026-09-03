import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class SetFreezeCommand implements EditCommand {
  private prev: [number, number] = [0, 0];

  constructor(
    private readonly host: EditHost,
    private readonly fri: number,
    private readonly fci: number,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.prev = [sheet.freeze[0], sheet.freeze[1]];
    sheet.setFreeze(this.fri, this.fci);
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().setFreeze(this.prev[0], this.prev[1]);
    this.host.afterChange();
  }
}
