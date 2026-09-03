import { isFormula } from "../model/Cell";
import type { Sheet } from "../model/Sheet";
import { xy2expr } from "../shared/alphabet";

export interface FormulaItem {
  name: string;
  label: string;
  group: "常用" | "逻辑" | "文本";
  range: boolean;
}

export const FORMULA_ITEMS: FormulaItem[] = [
  { name: "SUM", label: "求和", group: "常用", range: true },
  { name: "AVERAGE", label: "平均值", group: "常用", range: true },
  { name: "MAX", label: "最大值", group: "常用", range: true },
  { name: "MIN", label: "最小值", group: "常用", range: true },
  { name: "IF", label: "IF", group: "逻辑", range: false },
  { name: "AND", label: "AND", group: "逻辑", range: true },
  { name: "OR", label: "OR", group: "逻辑", range: true },
  { name: "CONCAT", label: "连接", group: "文本", range: true },
];

export function formulaStub(name: string, range?: string): string {
  if (name === "IF") {
    return "=IF(,,)";
  }
  return range ? `=${name}(${range})` : `=${name}()`;
}

export function guessNumberRange(sheet: Sheet, ri: number, ci: number): string | undefined {
  const vertical = span(sheet, ri, ci, "row");
  if (vertical) {
    return vertical;
  }
  return span(sheet, ri, ci, "column");
}

function span(sheet: Sheet, ri: number, ci: number, axis: "row" | "column"): string | undefined {
  let start = -1;
  let end = -1;
  if (axis === "row") {
    for (let r = ri - 1; r >= 0; r -= 1) {
      if (sheet.isRowHidden(r)) {
        continue;
      }
      if (!isNumericLike(sheet, r, ci)) {
        break;
      }
      if (end < 0) {
        end = r;
      }
      start = r;
    }
    if (start < 0 || end < 0) {
      return undefined;
    }
    return start === end ? xy2expr(ci, start) : `${xy2expr(ci, start)}:${xy2expr(ci, end)}`;
  }
  for (let c = ci - 1; c >= 0; c -= 1) {
    if (!isNumericLike(sheet, ri, c)) {
      break;
    }
    if (end < 0) {
      end = c;
    }
    start = c;
  }
  if (start < 0 || end < 0) {
    return undefined;
  }
  return start === end ? xy2expr(start, ri) : `${xy2expr(start, ri)}:${xy2expr(end, ri)}`;
}

function isNumericLike(sheet: Sheet, ri: number, ci: number): boolean {
  const cell = sheet.getCell(ri, ci);
  if (!cell) {
    return false;
  }
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return true;
  }
  const text = cell.text ?? "";
  if (isFormula(text)) {
    return Number.isFinite(Number(cell.value));
  }
  return text.trim() !== "" && Number.isFinite(Number(text));
}
