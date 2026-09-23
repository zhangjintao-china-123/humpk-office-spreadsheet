import { DEFAULT_ROW_HEIGHT, DEFAULT_ROW_LEN } from "../shared/constants";
import { cellIsBlank, cloneCell, type Cell } from "./Cell";

export interface RowData {
  height?: number;
  cells?: Record<number, Cell>;
}

export class Rows {
  len: number;
  height: number;
  private data = new Map<number, RowData>();

  constructor(len = DEFAULT_ROW_LEN, height = DEFAULT_ROW_HEIGHT) {
    this.len = len;
    this.height = height;
  }

  get(ri: number): RowData | undefined {
    return this.data.get(ri);
  }

  getOrNew(ri: number): RowData {
    let row = this.data.get(ri);
    if (!row) {
      row = {};
      this.data.set(ri, row);
    }
    return row;
  }

  getHeight(ri: number): number {
    return this.data.get(ri)?.height ?? this.height;
  }

  setHeight(ri: number, height: number): void {
    this.getOrNew(ri).height = height;
  }

  getCell(ri: number, ci: number): Cell | undefined {
    return this.data.get(ri)?.cells?.[ci];
  }

  getCellOrNew(ri: number, ci: number): Cell {
    const row = this.getOrNew(ri);
    if (!row.cells) {
      row.cells = {};
    }
    let cell = row.cells[ci];
    if (!cell) {
      cell = {};
      row.cells[ci] = cell;
    }
    return cell;
  }

  setCell(ri: number, ci: number, cell: Cell | undefined): void {
    if (cellIsBlank(cell) || !cell) {
      const row = this.data.get(ri);
      if (row?.cells) {
        delete row.cells[ci];
        if (Object.keys(row.cells).length === 0) {
          delete row.cells;
        }
      }
      this.prune(ri);
      return;
    }
    const row = this.getOrNew(ri);
    if (!row.cells) {
      row.cells = {};
    }
    row.cells[ci] = cell;
  }

  setCellText(ri: number, ci: number, text: string): void {
    if (text === "") {
      const cell = this.getCell(ri, ci);
      if (!cell) {
        return;
      }
      delete cell.text;
      delete cell.value;
      this.setCell(ri, ci, cell);
      return;
    }
    const cell = this.getCellOrNew(ri, ci);
    cell.text = text;
    delete cell.value;
  }

  each(cb: (ri: number, row: RowData) => void): void {
    for (const [ri, row] of this.data) {
      cb(ri, row);
    }
  }

  insert(index: number, n: number): Map<number, RowData> {
    const moved = new Map<number, RowData>();
    const next = new Map<number, RowData>();
    for (const [ri, row] of this.data) {
      if (ri >= index) {
        next.set(ri + n, row);
        moved.set(ri + n, row);
      } else {
        next.set(ri, row);
      }
    }
    this.data = next;
    this.len += n;
    return moved;
  }

  remove(index: number, n: number): Map<number, RowData> {
    const removed = new Map<number, RowData>();
    const next = new Map<number, RowData>();
    for (const [ri, row] of this.data) {
      if (ri >= index && ri < index + n) {
        removed.set(ri, row);
      } else if (ri >= index + n) {
        next.set(ri - n, row);
      } else {
        next.set(ri, row);
      }
    }
    this.data = next;
    this.len = Math.max(1, this.len - n);
    return removed;
  }

  restore(snapshot: Map<number, RowData>, len: number): void {
    this.data = new Map(snapshot);
    this.len = len;
  }

  snapshot(): Map<number, RowData> {
    const copy = new Map<number, RowData>();
    for (const [ri, row] of this.data) {
      copy.set(ri, cloneRow(row));
    }
    return copy;
  }

  shiftCells(type: "row" | "column", index: number, n: number): void {
    if (type === "column") {
      for (const row of this.data.values()) {
        if (!row.cells) {
          continue;
        }
        const next: Record<number, Cell> = {};
        for (const [key, cell] of Object.entries(row.cells)) {
          const ci = Number(key);
          if (n > 0) {
            next[ci >= index ? ci + n : ci] = cell;
          } else {
            const end = index - n;
            if (ci >= index && ci < end) {
              continue;
            }
            next[ci >= end ? ci + n : ci] = cell;
          }
        }
        row.cells = next;
      }
    }
  }

  getData(): Record<string, unknown> {
    const out: Record<string, unknown> = { len: this.len };
    for (const [ri, row] of this.data) {
      const cells: Record<string, Cell> = {};
      if (row.cells) {
        for (const [ci, cell] of Object.entries(row.cells)) {
          cells[ci] = { ...cell };
        }
      }
      const packed: RowData = {};
      if (row.height !== undefined) {
        packed.height = row.height;
      }
      if (Object.keys(cells).length > 0) {
        packed.cells = cells;
      }
      if (packed.height !== undefined || packed.cells) {
        out[String(ri)] = packed;
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
      const ri = Number(key);
      if (!Number.isInteger(ri)) {
        continue;
      }
      this.data.set(ri, cloneRow(value as RowData));
    }
  }

  private prune(ri: number): void {
    const row = this.data.get(ri);
    if (!row) {
      return;
    }
    if (row.height === undefined && (!row.cells || Object.keys(row.cells).length === 0)) {
      this.data.delete(ri);
    }
  }
}

function cloneRow(row: RowData): RowData {
  const cells: Record<number, Cell> | undefined = row.cells
    ? Object.fromEntries(Object.entries(row.cells).map(([ci, cell]) => [Number(ci), cloneCell(cell) ?? {}]))
    : undefined;
  return {
    height: row.height,
    cells,
  };
}
