import { CellRange } from "./CellRange";

export class Merges {
  private items: CellRange[] = [];

  forEach(cb: (range: CellRange) => void): void {
    this.items.forEach(cb);
  }

  getFirstIncludes(ri: number, ci: number): CellRange | undefined {
    return this.items.find((item) => item.includes(ri, ci));
  }

  intersects(range: CellRange): boolean {
    return this.items.some((item) => item.intersects(range));
  }

  add(range: CellRange): void {
    this.deleteWithin(range);
    this.items.push(range.clone());
  }

  deleteWithin(range: CellRange): void {
    this.items = this.items.filter((item) => !item.within(range));
  }

  removeAt(ri: number, ci: number): CellRange | undefined {
    const found = this.getFirstIncludes(ri, ci);
    if (!found) {
      return undefined;
    }
    this.items = this.items.filter((item) => item !== found);
    return found;
  }

  shift(type: "row" | "column", index: number, n: number): void {
    const next: CellRange[] = [];
    for (const range of this.items) {
      const copy = range.clone();
      if (type === "row") {
        if (copy.sri >= index) {
          copy.sri += n;
          copy.eri += n;
        } else if (copy.sri < index && index <= copy.eri) {
          copy.eri += n;
        }
      } else if (copy.sci >= index) {
        copy.sci += n;
        copy.eci += n;
      } else if (copy.sci < index && index <= copy.eci) {
        copy.eci += n;
      }
      if (copy.sri >= 0 && copy.sci >= 0 && copy.eri >= copy.sri && copy.eci >= copy.sci) {
        next.push(copy);
      }
    }
    this.items = next;
  }

  snapshot(): CellRange[] {
    return this.items.map((item) => item.clone());
  }

  restore(items: CellRange[]): void {
    this.items = items.map((item) => item.clone());
  }

  getData(): string[] {
    return this.items.map((item) => item.toString());
  }

  setData(refs: string[] | undefined): void {
    this.items = (refs ?? []).map((ref) => CellRange.valueOf(ref));
  }
}
