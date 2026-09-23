import type { Sheet } from "../model/Sheet";

export class CellNavigator {
  static hasContent(sheet: Sheet, ri: number, ci: number): boolean {
    const text = sheet.getCell(ri, ci)?.text;
    return text !== undefined && text !== "";
  }

  static lastUsed(sheet: Sheet): { ri: number; ci: number } {
    let ri = 0;
    let ci = 0;
    sheet.rows.each((rowIndex, row) => {
      if (!row.cells) {
        return;
      }
      for (const key of Object.keys(row.cells)) {
        const col = Number(key);
        const cell = row.cells[col];
        if (cell?.text) {
          ri = Math.max(ri, rowIndex);
          ci = Math.max(ci, col);
        }
      }
    });
    return { ri, ci };
  }

  static lastUsedInRow(sheet: Sheet, ri: number): number {
    const row = sheet.rows.get(ri);
    if (!row?.cells) {
      return 0;
    }
    let ci = 0;
    for (const key of Object.keys(row.cells)) {
      const col = Number(key);
      if (row.cells[col]?.text) {
        ci = Math.max(ci, col);
      }
    }
    return ci;
  }

  static step(sheet: Sheet, ri: number, ci: number, dri: number, dci: number): { ri: number; ci: number } {
    const merge = sheet.merges.getFirstIncludes(ri, ci);
    let nextRi = ri + dri;
    let nextCi = ci + dci;
    if (merge) {
      if (dri > 0) {
        nextRi = Math.max(nextRi, merge.eri + 1);
      } else if (dri < 0) {
        nextRi = Math.min(nextRi, merge.sri - 1);
      }
      if (dci > 0) {
        nextCi = Math.max(nextCi, merge.eci + 1);
      } else if (dci < 0) {
        nextCi = Math.min(nextCi, merge.sci - 1);
      }
    }
    return {
      ri: clamp(nextRi, 0, sheet.rows.len - 1),
      ci: clamp(nextCi, 0, sheet.cols.len - 1),
    };
  }

  static edge(sheet: Sheet, ri: number, ci: number, dri: number, dci: number): { ri: number; ci: number } {
    const maxR = sheet.rows.len - 1;
    const maxC = sheet.cols.len - 1;
    const startFilled = CellNavigator.hasContent(sheet, ri, ci);
    const first = CellNavigator.step(sheet, ri, ci, dri, dci);
    if (first.ri === ri && first.ci === ci) {
      return origin(sheet, ri, ci);
    }
    let r = first.ri;
    let c = first.ci;
    if (startFilled && CellNavigator.hasContent(sheet, r, c)) {
      while (inBounds(r + dri, c + dci, maxR, maxC) && CellNavigator.hasContent(sheet, r + dri, c + dci)) {
        r += dri;
        c += dci;
      }
      return origin(sheet, r, c);
    }
    while (inBounds(r, c, maxR, maxC) && !CellNavigator.hasContent(sheet, r, c)) {
      r += dri;
      c += dci;
    }
    if (!inBounds(r, c, maxR, maxC)) {
      return origin(sheet, clamp(r - dri, 0, maxR), clamp(c - dci, 0, maxC));
    }
    return origin(sheet, r, c);
  }
}

function origin(sheet: Sheet, ri: number, ci: number): { ri: number; ci: number } {
  return sheet.mergeOrigin(ri, ci);
}

function inBounds(ri: number, ci: number, maxR: number, maxC: number): boolean {
  return ri >= 0 && ri <= maxR && ci >= 0 && ci <= maxC;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
