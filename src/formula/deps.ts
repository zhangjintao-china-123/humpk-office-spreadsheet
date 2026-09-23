import { isFormula } from "../model/Cell";
import { syncLiteralValue } from "../model/InputParse";
import { CellRange } from "../model/CellRange";
import type { Sheet } from "../model/Sheet";
import { expr2xy, indexAt } from "../shared/alphabet";
import type { Ast } from "./Ast";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";

export type Precedent =
  | { kind: "point"; sheetName?: string; ri: number; ci: number }
  | { kind: "range"; sheetName?: string; sri: number; sci: number; eri: number; eci: number };

export type RangeWatch = {
  sheet: Sheet;
  sri: number;
  sci: number;
  eri: number;
  eci: number;
  formulaKey: string;
};

export function collectFormulaPrecedents(formula: string): Precedent[] {
  if (!isFormula(formula)) {
    return [];
  }
  try {
    const ast = new Parser(new Lexer(formula.slice(1)).tokenize()).parse();
    const found: Precedent[] = [];
    walkAst(ast, found);
    return found;
  } catch {
    return [];
  }
}

export function resolveDepSheet(sheets: Sheet[], current: Sheet, name?: string): Sheet | undefined {
  if (!name) {
    return current;
  }
  const key = name.trim().toLowerCase();
  return sheets.find((item) => item.table === current.table && item.name.trim().toLowerCase() === key);
}

export function refreshLiteralValue(sheet: Sheet, ri: number, ci: number): void {
  const cell = sheet.getCell(ri, ci);
  if (!cell) {
    return;
  }
  const text = cell.text ?? "";
  if (isFormula(text)) {
    return;
  }
  syncLiteralValue(cell, sheet.getCellStyle(ri, ci).numFmt);
}

function walkAst(ast: Ast, out: Precedent[]): void {
  switch (ast.kind) {
    case "ref":
      pushPoint(out, ast.value, ast.sheet);
      return;
    case "range":
      pushRange(out, ast.start, ast.end, ast.sheet);
      return;
    case "unary":
      walkAst(ast.expr, out);
      return;
    case "binary":
      walkAst(ast.left, out);
      walkAst(ast.right, out);
      return;
    case "call":
      for (const arg of ast.args) {
        walkAst(arg, out);
      }
      return;
    default:
      return;
  }
}

function isColumnRef(ref: string): boolean {
  return /^[A-Z]+$/i.test(ref.trim());
}

function pushPoint(out: Precedent[], ref: string, sheetName?: string): void {
  if (ref === "#REF!") {
    return;
  }
  const [ci, ri] = expr2xy(ref);
  if (ci < 0 || ri < 0) {
    return;
  }
  out.push({ kind: "point", sheetName, ri, ci });
}

function pushRange(out: Precedent[], start: string, end: string, sheetName?: string): void {
  if (start === "#REF!" || end === "#REF!") {
    return;
  }
  if (isColumnRef(start) || isColumnRef(end)) {
    const startCol = isColumnRef(start) ? indexAt(start) : expr2xy(start)[0];
    const endCol = isColumnRef(end) ? indexAt(end) : expr2xy(end)[0];
    const startRow = isColumnRef(start) ? 0 : expr2xy(start)[1];
    const endRow = isColumnRef(end) ? Number.MAX_SAFE_INTEGER : expr2xy(end)[1];
    out.push({
      kind: "range",
      sheetName,
      sri: Math.min(startRow, endRow),
      sci: Math.min(startCol, endCol),
      eri: Math.max(startRow, endRow),
      eci: Math.max(startCol, endCol),
    });
    return;
  }
  const range = CellRange.valueOf(`${start}:${end}`);
  out.push({
    kind: "range",
    sheetName,
    sri: range.sri,
    sci: range.sci,
    eri: range.eri,
    eci: range.eci,
  });
}
