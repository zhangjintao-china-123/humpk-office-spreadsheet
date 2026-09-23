import { isFormula } from "../model/Cell";
import type { Sheet } from "../model/Sheet";
import { xy2expr } from "../shared/alphabet";

export interface FormulaItem {
  name: string;
  label: string;
  group: "常用" | "逻辑" | "条件" | "查找" | "数学" | "文本" | "日期";
  range: boolean;
}

export const FORMULA_GROUP_ORDER: FormulaItem["group"][] = [
  "常用",
  "逻辑",
  "条件",
  "查找",
  "数学",
  "文本",
  "日期",
];

export function formulasInGroup(group: FormulaItem["group"]): FormulaItem[] {
  return FORMULA_ITEMS.filter((item) => item.group === group);
}

export function formulaMenuLabel(item: FormulaItem): string {
  return item.label === item.name ? item.name : `${item.name}　${item.label}`;
}

export const FORMULA_ITEMS: FormulaItem[] = [
  { name: "SUM", label: "求和", group: "常用", range: true },
  { name: "AVERAGE", label: "平均值", group: "常用", range: true },
  { name: "MAX", label: "最大值", group: "常用", range: true },
  { name: "MIN", label: "最小值", group: "常用", range: true },
  { name: "COUNT", label: "计数", group: "常用", range: true },
  { name: "COUNTA", label: "非空计数", group: "常用", range: true },
  { name: "IF", label: "条件判断", group: "逻辑", range: false },
  { name: "IFS", label: "多条件判断", group: "逻辑", range: false },
  { name: "IFERROR", label: "遇错返回", group: "逻辑", range: false },
  { name: "IFNA", label: "遇#N/A返回", group: "逻辑", range: false },
  { name: "AND", label: "与", group: "逻辑", range: true },
  { name: "OR", label: "或", group: "逻辑", range: true },
  { name: "NOT", label: "非", group: "逻辑", range: false },
  { name: "XOR", label: "异或", group: "逻辑", range: true },
  { name: "ISBLANK", label: "是否空白", group: "逻辑", range: false },
  { name: "ISERROR", label: "是否错误", group: "逻辑", range: false },
  { name: "ISNA", label: "是否#N/A", group: "逻辑", range: false },
  { name: "ISNUMBER", label: "是否数字", group: "逻辑", range: false },
  { name: "ISTEXT", label: "是否文本", group: "逻辑", range: false },
  { name: "SWITCH", label: "多值匹配", group: "逻辑", range: false },
  { name: "CHOOSE", label: "按序号选取", group: "逻辑", range: false },
  { name: "SUMIF", label: "一文件多格", group: "条件", range: true },
  { name: "SUMIFS", label: "一文件多条件", group: "条件", range: true },
  { name: "COUNTIF", label: "条件计数", group: "条件", range: true },
  { name: "COUNTIFS", label: "多条件计数", group: "条件", range: true },
  { name: "AVERAGEIF", label: "条件平均", group: "条件", range: true },
  { name: "INDEX", label: "按位置取值", group: "查找", range: true },
  { name: "MATCH", label: "查找位置", group: "查找", range: true },
  { name: "VLOOKUP", label: "列查找", group: "查找", range: true },
  { name: "XLOOKUP", label: "查找引用", group: "查找", range: true },
  { name: "ROUND", label: "四舍五入", group: "数学", range: false },
  { name: "ROUNDUP", label: "向上取整", group: "数学", range: false },
  { name: "ROUNDDOWN", label: "向下取整", group: "数学", range: false },
  { name: "ABS", label: "绝对值", group: "数学", range: false },
  { name: "INT", label: "取整", group: "数学", range: false },
  { name: "MOD", label: "求余", group: "数学", range: false },
  { name: "CONCAT", label: "连接", group: "文本", range: true },
  { name: "LEFT", label: "左侧文本", group: "文本", range: false },
  { name: "RIGHT", label: "右侧文本", group: "文本", range: false },
  { name: "MID", label: "中间文本", group: "文本", range: false },
  { name: "LEN", label: "字符数", group: "文本", range: false },
  { name: "TRIM", label: "去空格", group: "文本", range: false },
  { name: "SUBSTITUTE", label: "替换文本", group: "文本", range: false },
  { name: "TEXT", label: "数字转文本", group: "文本", range: false },
  { name: "DATE", label: "指定日期", group: "日期", range: false },
  { name: "TODAY", label: "今天", group: "日期", range: false },
  { name: "YEAR", label: "年份", group: "日期", range: false },
  { name: "MONTH", label: "月份", group: "日期", range: false },
  { name: "DAY", label: "日", group: "日期", range: false },
];

const STUBS: Record<string, (range?: string) => string> = {
  IF: () => "=IF(,,)",
  IFS: () => "=IFS(,)",
  IFERROR: () => "=IFERROR(,)",
  IFNA: () => "=IFNA(,)",
  NOT: () => "=NOT()",
  XOR: (range) => (range ? `=XOR(${range})` : "=XOR()"),
  SWITCH: () => "=SWITCH(,,)",
  CHOOSE: () => "=CHOOSE(,)",
  ISBLANK: () => "=ISBLANK()",
  ISERROR: () => "=ISERROR()",
  ISNA: () => "=ISNA()",
  ISNUMBER: () => "=ISNUMBER()",
  ISTEXT: () => "=ISTEXT()",
  SUMIF: (range) => (range ? `=SUMIF(${range},)` : "=SUMIF(,)"),
  SUMIFS: (range) => (range ? `=SUMIFS(${range},,)` : "=SUMIFS(,,)"),
  COUNTIF: (range) => (range ? `=COUNTIF(${range},)` : "=COUNTIF(,)"),
  COUNTIFS: (range) => (range ? `=COUNTIFS(${range},)` : "=COUNTIFS(,)"),
  AVERAGEIF: (range) => (range ? `=AVERAGEIF(${range},)` : "=AVERAGEIF(,)"),
  INDEX: (range) => (range ? `=INDEX(${range},)` : "=INDEX(,)"),
  MATCH: (range) => (range ? `=MATCH(,${range})` : "=MATCH(,)"),
  VLOOKUP: (range) => (range ? `=VLOOKUP(,${range},)` : "=VLOOKUP(,,)"),
  XLOOKUP: (range) => (range ? `=XLOOKUP(,${range},)` : "=XLOOKUP(,,)"),
  ROUND: () => "=ROUND(,)",
  ROUNDUP: () => "=ROUNDUP(,)",
  ROUNDDOWN: () => "=ROUNDDOWN(,)",
  ABS: () => "=ABS()",
  INT: () => "=INT()",
  MOD: () => "=MOD(,)",
  LEFT: () => "=LEFT(,)",
  RIGHT: () => "=RIGHT(,)",
  MID: () => "=MID(,,)",
  LEN: () => "=LEN()",
  TRIM: () => "=TRIM()",
  SUBSTITUTE: () => "=SUBSTITUTE(,,)",
  TEXT: () => "=TEXT(,)",
  DATE: () => "=DATE(,,)",
  TODAY: () => "=TODAY()",
  YEAR: () => "=YEAR()",
  MONTH: () => "=MONTH()",
  DAY: () => "=DAY()",
};

export function formulaStub(name: string, range?: string): string {
  const stub = STUBS[name];
  if (stub) {
    return stub(range);
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
