import { cloneCell, type Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import type { Sheet } from "../model/Sheet";

export interface ClipPayload {
  mode: "copy" | "cut";
  sheet: Sheet;
  range: CellRange;
  cells: Array<Array<Cell | undefined>>;
}

export class Clipboard {
  payload: ClipPayload | null = null;

  copy(sheet: Sheet, range: CellRange, mode: "copy" | "cut" = "copy"): ClipPayload {
    const cells: Array<Array<Cell | undefined>> = [];
    for (let ri = range.sri; ri <= range.eri; ri += 1) {
      const row: Array<Cell | undefined> = [];
      for (let ci = range.sci; ci <= range.eci; ci += 1) {
        row.push(cloneCell(sheet.getCell(ri, ci)));
      }
      cells.push(row);
    }
    this.payload = { mode, sheet, range: range.clone(), cells };
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
