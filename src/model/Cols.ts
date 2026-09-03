import { DEFAULT_COL_LEN, DEFAULT_COL_WIDTH } from "../shared/constants";

export interface ColData {
  width?: number;
}

export class Cols {
  len: number;
  width: number;
  private data = new Map<number, ColData>();

  constructor(len = DEFAULT_COL_LEN, width = DEFAULT_COL_WIDTH) {
    this.len = len;
    this.width = width;
  }

  getWidth(ci: number): number {
    return this.data.get(ci)?.width ?? this.width;
  }

  setWidth(ci: number, width: number): void {
    const col = this.data.get(ci) ?? {};
    col.width = width;
    this.data.set(ci, col);
  }

  insert(index: number, n: number): void {
    const next = new Map<number, ColData>();
    for (const [ci, col] of this.data) {
      next.set(ci >= index ? ci + n : ci, col);
    }
    this.data = next;
    this.len += n;
  }

  remove(index: number, n: number): Map<number, ColData> {
    const removed = new Map<number, ColData>();
    const next = new Map<number, ColData>();
    for (const [ci, col] of this.data) {
      if (ci >= index && ci < index + n) {
        removed.set(ci, col);
      } else if (ci >= index + n) {
        next.set(ci - n, col);
      } else {
        next.set(ci, col);
      }
    }
    this.data = next;
    this.len = Math.max(1, this.len - n);
    return removed;
  }

  snapshot(): Map<number, ColData> {
    return new Map(this.data);
  }

  restore(snapshot: Map<number, ColData>, len: number): void {
    this.data = new Map(snapshot);
    this.len = len;
  }

  getData(): Record<string, unknown> {
    const out: Record<string, unknown> = { len: this.len };
    for (const [ci, col] of this.data) {
      if (col.width !== undefined) {
        out[String(ci)] = { width: col.width };
      }
    }
    return out;
  }

  setData(raw: Record<string, unknown> | undefined): void {
    this.data.clear();
    if (!raw) {
      return;
    }
    if (typeof raw.len === "number") {
      this.len = raw.len;
    }
    for (const [key, value] of Object.entries(raw)) {
      if (key === "len" || !value || typeof value !== "object") {
        continue;
      }
      const ci = Number(key);
      if (!Number.isInteger(ci)) {
        continue;
      }
      const width = (value as ColData).width;
      if (width !== undefined) {
        this.data.set(ci, { width });
      }
    }
  }
}
