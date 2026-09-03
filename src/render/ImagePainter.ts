import { imageRect, type SheetImage } from "../model/SheetImage";
import type { Sheet } from "../model/Sheet";
import { handleBox } from "../selection/ImageHitTester";
import { HEADER_HEIGHT, INDEX_WIDTH, SELECTION_STROKE } from "../shared/constants";
import type { Draw } from "./Draw";
import type { PaintPane } from "./FreezePane";
import { imageCache } from "./image/ImageCache";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

export class ImagePainter {
  paint(draw: Draw, sheet: Sheet, scrollX: number, scrollY: number, selectedId?: number, pane?: PaintPane): void {
    const { cssWidth: w, cssHeight: h } = draw;
    draw.save();
    if (pane) {
      draw.clipRect(pane.clipX, pane.clipY, pane.clipW, pane.clipH);
    } else {
      draw.clipRect(INDEX_WIDTH, HEADER_HEIGHT, w - INDEX_WIDTH, h - HEADER_HEIGHT);
    }
    for (const image of sheet.images.list()) {
      this.paintImage(draw, image, scrollX, scrollY, w, h);
    }
    if (selectedId !== undefined) {
      const selected = sheet.images.get(selectedId);
      if (selected) {
        this.paintSelection(draw, selected, scrollX, scrollY);
      }
    }
    draw.restore();
  }

  private paintImage(draw: Draw, image: SheetImage, scrollX: number, scrollY: number, w: number, h: number): void {
    const rect = imageRect(image);
    const x = rect.x - scrollX;
    const y = rect.y - scrollY;
    if (x > w || y > h || x + rect.width < INDEX_WIDTH || y + rect.height < HEADER_HEIGHT) {
      return;
    }
    const ready = imageCache.ensure(image.url);
    if (ready) {
      draw.drawImage(ready, x, y, rect.width, rect.height);
    } else {
      draw.fillRect(x, y, rect.width, rect.height, "rgba(0, 0, 0, 0.06)");
      draw.strokeRect(x, y, rect.width, rect.height, "#bbbbbb");
    }
  }

  private paintSelection(draw: Draw, image: SheetImage, scrollX: number, scrollY: number): void {
    const rect = imageRect(image);
    const box = { x: rect.x - scrollX, y: rect.y - scrollY, width: rect.width, height: rect.height };
    draw.strokeRect(box.x, box.y, box.width, box.height, SELECTION_STROKE, 2);
    for (const handle of HANDLES) {
      const item = handleBox(box, handle);
      draw.fillRect(item.x, item.y, item.size, item.size, "#ffffff");
      draw.strokeRect(item.x, item.y, item.size, item.size, SELECTION_STROKE, 1);
    }
  }
}
