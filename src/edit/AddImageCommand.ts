import { cloneImage, type SheetImage } from "../model/SheetImage";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class AddImageCommand implements EditCommand {
  constructor(
    private readonly host: EditHost,
    private readonly image: SheetImage,
  ) {}

  do(): void {
    this.host.sheet().images.add(cloneImage(this.image));
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().images.remove(this.image.id);
    this.host.afterChange();
  }
}
