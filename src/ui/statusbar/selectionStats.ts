import type { Cell } from "../../model/Cell";
import { CellRange } from "../../model/CellRange";
import type { Sheet } from "../../model/Sheet";

export type SelectionStats = {
  count: number;
  numericCount: number;
  sum: number;
};

export function emptySelectionStats(): SelectionStats {
  return { count: 0, numericCount: 0, sum: 0 };
}

export function accumulateCell(stats: SelectionStats, cell: Cell | undefined): void {
  if (!cellNonEmpty(cell)) {
    return;
  }
  stats.count += 1;
  const n = cellNumeric(cell);
  if (n === null) {
    return;
  }
  stats.numericCount += 1;
  stats.sum += n;
}

export function selectionStats(sheet: Sheet, range: CellRange): SelectionStats {
  return selectionStatsForRanges(sheet, [range]);
}

export function selectionStatsForRanges(sheet: Sheet, ranges: CellRange[]): SelectionStats {
  if (ranges.length === 0 || (ranges.length === 1 && !ranges[0].multiple())) {
    return emptySelectionStats();
  }
  const stats = emptySelectionStats();
  sheet.rows.each((ri, row) => {
    if (!row.cells) {
      return;
    }
    for (const [key, cell] of Object.entries(row.cells)) {
      const ci = Number(key);
      if (!ranges.some((range) => range.includes(ri, ci))) {
        continue;
      }
      accumulateCell(stats, cell);
    }
  });
  return stats;
}

export function formatStatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return Math.round(value).toLocaleString("zh-CN");
  }
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
}

export function formatSelectionStats(stats: SelectionStats): string[] {
  const parts: string[] = [];
  if (stats.numericCount >= 2) {
    parts.push(`平均值: ${formatStatNumber(stats.sum / stats.numericCount)}`);
  }
  if (stats.count >= 2) {
    parts.push(`计数: ${stats.count.toLocaleString("zh-CN")}`);
  }
  if (stats.numericCount >= 2) {
    parts.push(`求和: ${formatStatNumber(stats.sum)}`);
  }
  return parts;
}

function cellNonEmpty(cell: Cell | undefined): boolean {
  if (!cell) {
    return false;
  }
  if (cell.value !== undefined && cell.value !== "") {
    return true;
  }
  return cell.text !== undefined && cell.text !== "";
}

function cellNumeric(cell: Cell | undefined): number | null {
  if (!cell) {
    return null;
  }
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return cell.value;
  }
  if (typeof cell.value === "string" && cell.value !== "") {
    const n = Number(cell.value);
    return Number.isFinite(n) ? n : null;
  }
  if (cell.text && !cell.text.startsWith("=")) {
    const n = Number(cell.text);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
