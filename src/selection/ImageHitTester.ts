import { imageRect, type ImageHandle, type SheetImage } from "../model/SheetImage";
import type { Sheet } from "../model/Sheet";
import { appliedScroll } from "../render/FreezePane";
import { HEADER_HEIGHT, INDEX_WIDTH } from "../shared/constants";

const HANDLE = 7;

export interface ImageHit {
  kind: "image" | "image-resize";
  id: number;
  handle?: ImageHandle;
}

const HANDLES: ImageHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export const IMAGE_CURSORS: Record<ImageHandle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

export class ImageHitTester {
  hit(sheet: Sheet, x: number, y: number, scrollX: number, scrollY: number, selectedId?: number): ImageHit | undefined {
    if (x < INDEX_WIDTH || y < HEADER_HEIGHT) {
      return undefined;
    }
    if (selectedId !== undefined) {
      const selected = sheet.images.get(selectedId);
      if (selected) {
        const handle = hitHandle(sheet, selected, x, y, scrollX, scrollY);
        if (handle) {
          return { kind: "image-resize", id: selectedId, handle };
        }
      }
    }
    const images = sheet.images.list();
    for (let i = images.length - 1; i >= 0; i -= 1) {
      const image = images[i];
      if (contains(sheet, image, x, y, scrollX, scrollY)) {
        return { kind: "image", id: image.id };
      }
    }
    return undefined;
  }
}

function screenRect(
  sheet: Sheet,
  image: SheetImage,
  scrollX: number,
  scrollY: number,
): { x: number; y: number; width: number; height: number } {
  const rect = imageRect(image);
  const applied = appliedScroll(sheet, rect.x - INDEX_WIDTH, rect.y - HEADER_HEIGHT, scrollX, scrollY);
  return {
    x: rect.x - applied.x,
    y: rect.y - applied.y,
    width: rect.width,
    height: rect.height,
  };
}

function contains(sheet: Sheet, image: SheetImage, x: number, y: number, scrollX: number, scrollY: number): boolean {
  const rect = screenRect(sheet, image, scrollX, scrollY);
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function hitHandle(
  sheet: Sheet,
  image: SheetImage,
  x: number,
  y: number,
  scrollX: number,
  scrollY: number,
): ImageHandle | undefined {
  const rect = screenRect(sheet, image, scrollX, scrollY);
  for (const handle of HANDLES) {
    const box = handleBox(rect, handle);
    if (x >= box.x && x <= box.x + box.size && y >= box.y && y <= box.y + box.size) {
      return handle;
    }
  }
  return undefined;
}

export function handleBox(
  rect: { x: number; y: number; width: number; height: number },
  handle: ImageHandle,
): { x: number; y: number; size: number } {
  const midX = rect.x + rect.width / 2 - HANDLE / 2;
  const midY = rect.y + rect.height / 2 - HANDLE / 2;
  const right = rect.x + rect.width - HANDLE / 2;
  const bottom = rect.y + rect.height - HANDLE / 2;
  const left = rect.x - HANDLE / 2;
  const top = rect.y - HANDLE / 2;
  if (handle === "nw") {
    return { x: left, y: top, size: HANDLE };
  }
  if (handle === "n") {
    return { x: midX, y: top, size: HANDLE };
  }
  if (handle === "ne") {
    return { x: right, y: top, size: HANDLE };
  }
  if (handle === "e") {
    return { x: right, y: midY, size: HANDLE };
  }
  if (handle === "se") {
    return { x: right, y: bottom, size: HANDLE };
  }
  if (handle === "s") {
    return { x: midX, y: bottom, size: HANDLE };
  }
  if (handle === "sw") {
    return { x: left, y: bottom, size: HANDLE };
  }
  return { x: left, y: midY, size: HANDLE };
}
