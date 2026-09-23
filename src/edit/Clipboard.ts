import { cloneCell, type Cell } from "../model/Cell";
import { CellRange } from "../model/CellRange";
import type { Sheet } from "../model/Sheet";

export interface ClipPayload {
  mode: "copy" | "cut";
  sheet: Sheet;
  range: CellRange;
  cells: Array<Array<Cell | undefined>>;
}

export class Clipboard {
  payload: ClipPayload | null = null;

  copy(sheet: Sheet, range: CellRange | CellRange[], mode: "copy" | "cut" = "copy"): ClipPayload {
    const ranges = Array.isArray(range) ? range : [range];
    const box = ranges.length === 0
      ? CellRange.cell(0, 0)
      : ranges.reduce((acc, item) => acc.union(item));
    const cells: Array<Array<Cell | undefined>> = [];
    for (let ri = box.sri; ri <= box.eri; ri += 1) {
      const row: Array<Cell | undefined> = [];
      for (let ci = box.sci; ci <= box.eci; ci += 1) {
        const selected = ranges.some((item) => item.includes(ri, ci));
        row.push(selected ? cloneCell(sheet.getCell(ri, ci)) : undefined);
      }
      cells.push(row);
    }
    this.payload = { mode, sheet, range: box.clone(), cells };
    return this.payload;
  }

  toTsv(payload = this.payload): string {
    if (!payload) {
      return "";
    }
    return payload.cells
      .map((row) => row.map((cell) => (cell?.text ?? "").replaceAll("\t", " ").replaceAll("\n", " ")).join("\t"))
      .join("\n");
  }

  fromTsv(text: string): Array<Array<Cell | undefined>> {
    return text.split(/\r?\n/).map((line) => line.split("\t").map((item) => (item ? { text: item } : undefined)));
  }

  clear(): void {
    this.payload = null;
  }
}
