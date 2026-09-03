import { cloneOptions, type SheetImageOptions } from "../model/SheetImage";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class UpdateImageCommand implements EditCommand {
  constructor(
    private readonly host: EditHost,
    private readonly id: number,
    private readonly next: SheetImageOptions,
    private readonly prev: SheetImageOptions,
  ) {}

  do(): void {
    this.host.sheet().images.setOptions(this.id, cloneOptions(this.next));
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().images.setOptions(this.id, cloneOptions(this.prev));
    this.host.afterChange();
  }
}
