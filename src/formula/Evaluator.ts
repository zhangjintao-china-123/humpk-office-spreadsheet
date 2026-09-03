import { expr2xy } from "../shared/alphabet";
import { isFormula } from "../model/Cell";
import { CellRange } from "../model/CellRange";
import type { Sheet } from "../model/Sheet";
import type { Ast } from "./Ast";
import { FUNCTIONS, type FormulaValue } from "./functions";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";

export class FormulaError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "FormulaError";
  }
}

export class Evaluator {
  private visiting = new Set<string>();

  constructor(private readonly sheet: Sheet) {}

  evaluate(ast: Ast): FormulaValue {
    return this.visit(ast);
  }

  cellValue(ri: number, ci: number): FormulaValue {
    const key = `${ri},${ci}`;
    if (this.visiting.has(key)) {
      throw new FormulaError("#CIRCLE!");
    }
    const cell = this.sheet.getCell(ri, ci);
    const text = cell?.text ?? "";
    if (!isFormula(text)) {
      if (text === "") {
        return "";
      }
      const n = Number(text);
      return Number.isFinite(n) && text.trim() !== "" ? n : text;
    }
    this.visiting.add(key);
    try {
      const ast = new Parser(new Lexer(text.slice(1)).tokenize()).parse();
      const value = this.visit(ast);
      if (cell) {
        cell.value = stringifyValue(value);
      }
      return value;
    } catch (error) {
      const code = error instanceof FormulaError ? error.code : "#VALUE!";
      if (cell) {
        cell.value = code;
      }
      throw error instanceof FormulaError ? error : new FormulaError(code);
    } finally {
      this.visiting.delete(key);
    }
  }

  argValues(ast: Ast): FormulaValue[] {
    if (ast.kind === "range") {
      return this.rangeValues(ast.start, ast.end);
    }
    return [this.visit(ast)];
  }

  private visit(ast: Ast): FormulaValue {
    switch (ast.kind) {
      case "number":
        return ast.value;
      case "string":
        return ast.value;
      case "ref":
        return this.refValue(ast.value);
      case "range":
        throw new FormulaError("#VALUE!");
      case "unary":
        return -(asNumber(this.visit(ast.expr)) ?? 0);
      case "binary":
        return this.binary(ast.op, this.visit(ast.left), this.visit(ast.right));
      case "call":
        return this.call(ast.name, ast.args);
    }
  }

  private refValue(ref: string): FormulaValue {
    if (ref === "#REF!") {
      throw new FormulaError("#REF!");
    }
    const [ci, ri] = expr2xy(ref);
    return this.cellValue(ri, ci);
  }

  private rangeValues(start: string, end: string): FormulaValue[] {
    if (start === "#REF!" || end === "#REF!") {
      throw new FormulaError("#REF!");
    }
    const range = CellRange.valueOf(`${start}:${end}`);
    const values: FormulaValue[] = [];
    range.each((ri, ci) => {
      values.push(this.cellValue(ri, ci));
    });
    return values;
  }

  private call(name: string, args: Ast[]): FormulaValue {
    const fn = FUNCTIONS[name];
    if (!fn) {
      throw new FormulaError("#NAME?");
    }
    return fn(args.map((arg) => this.argValues(arg)));
  }

  private binary(
    op: "+" | "-" | "*" | "/" | "=" | "<>" | ">" | ">=" | "<" | "<=",
    left: FormulaValue,
    right: FormulaValue,
  ): FormulaValue {
    if (op === "=") {
      return left === right || Number(left) === Number(right);
    }
    if (op === "<>") {
      return left !== right && Number(left) !== Number(right);
    }
    if (op === ">" || op === ">=" || op === "<" || op === "<=") {
      const a = asNumber(left);
      const b = asNumber(right);
      if (a === null || b === null) {
        throw new FormulaError("#VALUE!");
      }
      if (op === ">") {
        return a > b;
      }
      if (op === ">=") {
        return a >= b;
      }
      if (op === "<") {
        return a < b;
      }
      return a <= b;
    }
    if (op === "+" && (typeof left === "string" || typeof right === "string")) {
      return `${left ?? ""}${right ?? ""}`;
    }
    const a = asNumber(left);
    const b = asNumber(right);
    if (a === null || b === null) {
      throw new FormulaError("#VALUE!");
    }
    if (op === "+") {
      return a + b;
    }
    if (op === "-") {
      return a - b;
    }
    if (op === "*") {
      return a * b;
    }
    if (b === 0) {
      throw new FormulaError("#DIV/0!");
    }
    return a / b;
  }
}

export function stringifyValue(value: FormulaValue): string | number {
  if (value === null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return value;
}

function asNumber(value: FormulaValue): number | null {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (value === null || value === "") {
    return 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
