import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class ResizeCommand implements EditCommand {
  constructor(
    private readonly host: EditHost,
    private readonly type: "row" | "column",
    private readonly index: number,
    private readonly next: number,
    private readonly prev: number,
  ) {}

  do(): void {
    this.apply(this.next);
  }

  undo(): void {
    this.apply(this.prev);
  }

  private apply(size: number): void {
    const sheet = this.host.sheet();
    if (this.type === "row") {
      sheet.rows.setHeight(this.index, size);
    } else {
      sheet.cols.setWidth(this.index, size);
    }
    this.host.afterChange();
  }
}
