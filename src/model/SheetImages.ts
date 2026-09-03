import { cloneImage, type SheetImage, type SheetImageOptions } from "./SheetImage";

export class SheetImages {
  private items: SheetImage[] = [];

  list(): SheetImage[] {
    return this.items;
  }

  size(): number {
    return this.items.length;
  }

  nextId(): number {
    return this.items.reduce((max, item) => Math.max(max, item.id), -1) + 1;
  }

  add(image: SheetImage): void {
    this.items.push(cloneImage(image));
  }

  get(id: number): SheetImage | undefined {
    return this.items.find((item) => item.id === id);
  }

  remove(id: number): SheetImage | undefined {
    const index = this.items.findIndex((item) => item.id === id);
    if (index < 0) {
      return undefined;
    }
    const [removed] = this.items.splice(index, 1);
    return removed;
  }

  setOptions(id: number, options: SheetImageOptions): void {
    const item = this.get(id);
    if (item) {
      item.options = { ...options };
    }
  }

  getData(): SheetImage[] {
    return this.items.map(cloneImage);
  }

  setData(raw: unknown): void {
    this.items = [];
    if (!Array.isArray(raw)) {
      return;
    }
    for (const item of raw) {
      const parsed = parseImage(item);
      if (parsed) {
        this.items.push(parsed);
      }
    }
  }

  restore(data: SheetImage[]): void {
    this.items = data.map(cloneImage);
  }
}

function parseImage(raw: unknown): SheetImage | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const item = raw as { id?: unknown; url?: unknown; options?: Record<string, unknown> };
  if (typeof item.url !== "string" || !item.url) {
    return undefined;
  }
  const options = item.options ?? {};
  return {
    id: typeof item.id === "number" ? item.id : Number(item.id) || 0,
    url: item.url,
    options: {
      left: numberOr(options.left, 0),
      top: numberOr(options.top, 0),
      width: numberOr(options.width, 200),
      height: numberOr(options.height, 200),
      scaleX: numberOr(options.scaleX, 1),
      scaleY: numberOr(options.scaleY, 1),
    },
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
