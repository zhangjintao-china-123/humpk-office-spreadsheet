import { expr2xy, xy2expr } from "../shared/alphabet";

export class CellRange {
  constructor(
    public sri: number,
    public sci: number,
    public eri: number,
    public eci: number,
  ) {
    if (this.eri < this.sri) {
      [this.sri, this.eri] = [this.eri, this.sri];
    }
    if (this.eci < this.sci) {
      [this.sci, this.eci] = [this.eci, this.sci];
    }
  }

  static cell(ri: number, ci: number): CellRange {
    return new CellRange(ri, ci, ri, ci);
  }

  static valueOf(ref: string): CellRange {
    const parts = ref.split(":");
    const [sci, sri] = expr2xy(parts[0]);
    if (parts.length === 1) {
      return new CellRange(sri, sci, sri, sci);
    }
    const [eci, eri] = expr2xy(parts[1]);
    return new CellRange(sri, sci, eri, eci);
  }

  set(sri: number, sci: number, eri: number, eci: number): void {
    this.sri = Math.min(sri, eri);
    this.eri = Math.max(sri, eri);
    this.sci = Math.min(sci, eci);
    this.eci = Math.max(sci, eci);
  }

  multiple(): boolean {
    return this.eri > this.sri || this.eci > this.sci;
  }

  includes(ri: number, ci: number): boolean {
    return this.sri <= ri && ri <= this.eri && this.sci <= ci && ci <= this.eci;
  }

  each(cb: (ri: number, ci: number) => void): void {
    for (let ri = this.sri; ri <= this.eri; ri += 1) {
      for (let ci = this.sci; ci <= this.eci; ci += 1) {
        cb(ri, ci);
      }
    }
  }

  contains(other: CellRange): boolean {
    return this.sri <= other.sri && this.sci <= other.sci && this.eri >= other.eri && this.eci >= other.eci;
  }

  within(other: CellRange): boolean {
    return other.contains(this);
  }

  intersects(other: CellRange): boolean {
    return this.sri <= other.eri && this.sci <= other.eci && other.sri <= this.eri && other.sci <= this.eci;
  }

  union(other: CellRange): CellRange {
    return new CellRange(
      Math.min(this.sri, other.sri),
      Math.min(this.sci, other.sci),
      Math.max(this.eri, other.eri),
      Math.max(this.eci, other.eci),
    );
  }

  rowCount(): number {
    return this.eri - this.sri + 1;
  }

  colCount(): number {
    return this.eci - this.sci + 1;
  }

  size(): [number, number] {
    return [this.rowCount(), this.colCount()];
  }

  toString(): string {
    const start = xy2expr(this.sci, this.sri);
    if (!this.multiple()) {
      return start;
    }
    return `${start}:${xy2expr(this.eci, this.eri)}`;
  }

  clone(): CellRange {
    return new CellRange(this.sri, this.sci, this.eri, this.eci);
  }

  equals(other: CellRange): boolean {
    return this.sri === other.sri && this.sci === other.sci && this.eri === other.eri && this.eci === other.eci;
  }
}
