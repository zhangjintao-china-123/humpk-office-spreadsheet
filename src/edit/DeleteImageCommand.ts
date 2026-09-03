import { cloneImage, type SheetImage } from "../model/SheetImage";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class DeleteImageCommand implements EditCommand {
  private snapshot: SheetImage;

  constructor(
    private readonly host: EditHost,
    image: SheetImage,
  ) {
    this.snapshot = cloneImage(image);
  }

  do(): void {
    this.host.sheet().images.remove(this.snapshot.id);
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().images.add(cloneImage(this.snapshot));
    this.host.afterChange();
  }
}
