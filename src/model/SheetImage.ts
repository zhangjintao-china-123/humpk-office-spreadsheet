export interface SheetImageOptions {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
}

export interface SheetImage {
  id: number;
  url: string;
  options: SheetImageOptions;
}

export interface ImageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ImageHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function imageScale(options: SheetImageOptions): { scaleX: number; scaleY: number } {
  return {
    scaleX: options.scaleX ?? 1,
    scaleY: options.scaleY ?? 1,
  };
}

export function imageRect(image: SheetImage): ImageRect {
  const { scaleX, scaleY } = imageScale(image.options);
  const width = Math.max(1, (image.options.width || 0) * scaleX);
  const height = Math.max(1, (image.options.height || 0) * scaleY);
  return {
    x: image.options.left - width / 2,
    y: image.options.top - height / 2,
    width,
    height,
  };
}

export function optionsFromRect(naturalWidth: number, naturalHeight: number, rect: ImageRect): SheetImageOptions {
  const width = Math.max(1, naturalWidth);
  const height = Math.max(1, naturalHeight);
  return {
    left: rect.x + rect.width / 2,
    top: rect.y + rect.height / 2,
    width,
    height,
    scaleX: rect.width / width,
    scaleY: rect.height / height,
  };
}

export function cloneOptions(options: SheetImageOptions): SheetImageOptions {
  return { ...options };
}

export function cloneImage(image: SheetImage): SheetImage {
  return {
    id: image.id,
    url: image.url,
    options: cloneOptions(image.options),
  };
}

export function resizeRect(rect: ImageRect, handle: ImageHandle, dx: number, dy: number, min: number): ImageRect {
  let { x, y, width, height } = rect;
  if (handle.includes("w")) {
    x += dx;
    width -= dx;
  } else if (handle.includes("e")) {
    width += dx;
  }
  if (handle.includes("n")) {
    y += dy;
    height -= dy;
  } else if (handle.includes("s")) {
    height += dy;
  }
  if (width < min) {
    if (handle.includes("w")) {
      x -= min - width;
    }
    width = min;
  }
  if (height < min) {
    if (handle.includes("n")) {
      y -= min - height;
    }
    height = min;
  }
  return { x, y, width, height };
}
