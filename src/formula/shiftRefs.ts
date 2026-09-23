import { expr2xy, xy2expr } from "../shared/alphabet";
import { isFormula } from "../model/Cell";
import type { Sheet } from "../model/Sheet";
import type { Ast } from "./Ast";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";

export interface ShiftSpec {
  type: "row" | "column";
  index: number;
  count: number;
}

export function shiftFormula(text: string, spec: ShiftSpec): string {
  if (!isFormula(text)) {
    return text;
  }
  try {
    const ast = new Parser(new Lexer(text.slice(1)).tokenize()).parse();
    return `=${printAst(shiftAst(ast, spec))}`;
  } catch {
    return text;
  }
}

export function shiftSheetFormulas(sheet: Sheet, spec: ShiftSpec): void {
  sheet.rows.each((_ri, row) => {
    if (!row.cells) {
      return;
    }
    for (const cell of Object.values(row.cells)) {
      if (cell.text && isFormula(cell.text)) {
        cell.text = shiftFormula(cell.text, spec);
      }
    }
  });
}

function shiftAst(ast: Ast, spec: ShiftSpec): Ast {
  switch (ast.kind) {
    case "ref":
      return { kind: "ref", value: shiftRef(ast.value, spec), sheet: ast.sheet };
    case "range":
      return {
        kind: "range",
        start: shiftRef(ast.start, spec),
        end: shiftRef(ast.end, spec),
        sheet: ast.sheet,
      };
    case "unary":
      return { kind: "unary", op: "-", expr: shiftAst(ast.expr, spec) };
    case "binary":
      return { kind: "binary", op: ast.op, left: shiftAst(ast.left, spec), right: shiftAst(ast.right, spec) };
    case "call":
      return { kind: "call", name: ast.name, args: ast.args.map((arg) => shiftAst(arg, spec)) };
    default:
      return ast;
  }
}

function shiftRef(ref: string, spec: ShiftSpec): string {
  if (ref === "#REF!") {
    return ref;
  }
  const [ci, ri] = expr2xy(ref);
  if (spec.type === "row") {
    if (spec.count < 0 && ri >= spec.index && ri < spec.index - spec.count) {
      return "#REF!";
    }
    if (ri >= spec.index) {
      const next = ri + spec.count;
      return next < 0 ? "#REF!" : xy2expr(ci, next);
    }
    return ref;
  }
  if (spec.count < 0 && ci >= spec.index && ci < spec.index - spec.count) {
    return "#REF!";
  }
  if (ci >= spec.index) {
    const next = ci + spec.count;
    return next < 0 ? "#REF!" : xy2expr(next, ri);
  }
  return ref;
}

function printSheetRef(sheet: string | undefined, ref: string): string {
  if (!sheet) {
    return ref;
  }
  const quoted = /^[A-Za-z_][A-Za-z0-9_]*$/.test(sheet)
    ? sheet
    : `'${sheet.replaceAll("'", "''")}'`;
  return `${quoted}!${ref}`;
}

function printAst(ast: Ast): string {
  switch (ast.kind) {
    case "number":
      return String(ast.value);
    case "string":
      return `"${ast.value}"`;
    case "ref":
      return printSheetRef(ast.sheet, ast.value);
    case "range":
      return printSheetRef(ast.sheet, `${ast.start}:${ast.end}`);
    case "unary":
      return `-${printAst(ast.expr)}`;
    case "binary":
      return `${printAst(ast.left)}${ast.op}${printAst(ast.right)}`;
    case "call":
      return `${ast.name}(${ast.args.map(printAst).join(",")})`;
  }
}
