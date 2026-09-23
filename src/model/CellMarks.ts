export type CellPriorityMark = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type CellShapeMark = "star" | "flag" | "diamond" | "square" | "triangle";

export type CellVerdictMark = "pass" | "fail";

export type CellMark = {
  priority?: CellPriorityMark;
  shape?: CellShapeMark;
  verdict?: CellVerdictMark;
};

export type MarkedCellRange = {
  sheetName: string;
  range: string;
  priority?: CellPriorityMark;
  shape?: CellShapeMark;
  verdict?: CellVerdictMark;
};

export const CELL_PRIORITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const CELL_SHAPES = ["star", "flag", "diamond", "square", "triangle"] as const;

export const CELL_VERDICTS = ["pass", "fail"] as const;

export const PRIORITY_COLORS: Record<CellPriorityMark, string> = {
  1: "#e2554a",
  2: "#f08a2c",
  3: "#2f7bf6",
  4: "#6b7a8c",
  5: "#6b7a8c",
  6: "#6b7a8c",
  7: "#6b7a8c",
  8: "#6b7a8c",
  9: "#6b7a8c",
  10: "#6b7a8c",
};

export const SHAPE_MARK_COLOR = "#6b7a8c";

export const SHAPE_LABELS: Record<CellShapeMark, string> = {
  star: "星形",
  flag: "旗标",
  diamond: "菱形",
  square: "方形",
  triangle: "三角形",
};

export const VERDICT_LABELS: Record<CellVerdictMark, string> = {
  pass: "对",
  fail: "错",
};

export const VERDICT_COLORS: Record<CellVerdictMark, string> = {
  pass: "#16a34a",
  fail: "#dc2626",
};

export function parsePriorityMark(value: unknown): CellPriorityMark | undefined {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    return undefined;
  }
  return n as CellPriorityMark;
}

export function parseShapeMark(value: unknown): CellShapeMark | undefined {
  const text = String(value ?? "").trim().toLowerCase();
  return (CELL_SHAPES as readonly string[]).includes(text) ? text as CellShapeMark : undefined;
}

export function parseVerdictMark(value: unknown): CellVerdictMark | undefined {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "pass" || text === "ok" || text === "check" || text === "对" || text === "勾") {
    return "pass";
  }
  if (text === "fail" || text === "error" || text === "cross" || text === "错" || text === "叉") {
    return "fail";
  }
  return undefined;
}

export function isEmptyMark(mark?: CellMark): boolean {
  return !mark?.priority && !mark?.shape && !mark?.verdict;
}

export function cellMarkBadgeCount(mark?: CellMark): number {
  if (!mark) {
    return 0;
  }
  return (mark.verdict ? 1 : 0) + (mark.priority ? 1 : 0) + (mark.shape ? 1 : 0);
}

const BADGE_PAD = 3;
const BADGE_GAP = 2;
const BADGE_TEXT_GAP = 2;

export function cellMarkBadgeLayout(width: number, height: number, mark?: CellMark): {
  count: number;
  size: number;
  rowWidth: number;
  reserve: number;
} | null {
  const count = cellMarkBadgeCount(mark);
  if (!count) {
    return null;
  }
  const size = Math.min(
    16,
    Math.max(11, Math.min(width - BADGE_PAD * 2 - (count - 1) * BADGE_GAP, height - BADGE_PAD * 2) / count),
  );
  const rowWidth = count * size + (count - 1) * BADGE_GAP;
  return {
    count,
    size,
    rowWidth,
    reserve: Math.min(width, BADGE_PAD + rowWidth + BADGE_TEXT_GAP),
  };
}

export function cellMarkBadgeReserve(width: number, height: number, mark?: CellMark): number {
  return cellMarkBadgeLayout(width, height, mark)?.reserve ?? 0;
}

export function cloneMark(mark?: CellMark): CellMark | undefined {
  if (!mark) {
    return undefined;
  }
  const next: CellMark = {};
  if (mark.priority) {
    next.priority = mark.priority;
  }
  if (mark.shape) {
    next.shape = mark.shape;
  }
  if (mark.verdict) {
    next.verdict = mark.verdict;
  }
  return isEmptyMark(next) ? undefined : next;
}

export function marksEqual(a?: CellMark, b?: CellMark): boolean {
  const left = cloneMark(a);
  const right = cloneMark(b);
  if (!left && !right) {
    return true;
  }
  return left?.priority === right?.priority && left?.shape === right?.shape && left?.verdict === right?.verdict;
}

export function formatMarkCaption(mark?: CellMark): string {
  const parts: string[] = [];
  if (mark?.verdict) {
    parts.push(VERDICT_LABELS[mark.verdict]);
  }
  if (mark?.priority) {
    parts.push(`优先级${mark.priority}`);
  }
  if (mark?.shape) {
    parts.push(SHAPE_LABELS[mark.shape]);
  }
  return parts.join("、");
}
