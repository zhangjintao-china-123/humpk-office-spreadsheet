import { expr2xy, indexAt } from "../shared/alphabet";
import { isFormula } from "../model/Cell";
import { isTextFormat } from "../model/NumberFormat";
import { CellRange } from "../model/CellRange";
import type { Sheet } from "../model/Sheet";
import type { Ast } from "./Ast";
import { FormulaError } from "./FormulaError";
import {
  FUNCTIONS,
  compareLookup,
  errorValue,
  excelLogical,
  isErrorValue,
  type FormulaErrorValue,
  matchCriteria,
  toNumber,
  type FormulaValue,
} from "./functions";
import { findTables, parseCrossCellRef, parsePivotPairs } from "./getPivotData";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";

export { FormulaError };

const sheetIds = new WeakMap<Sheet, string>();
let sheetSeq = 0;

export function sheetEvalId(sheet: Sheet): string {
  return sheetId(sheet);
}

function sheetId(sheet: Sheet): string {
  let id = sheetIds.get(sheet);
  if (!id) {
    sheetSeq += 1;
    id = `s${sheetSeq}`;
    sheetIds.set(sheet, id);
  }
  return id;
}

export type EvalCachePolicy = {
  dirty: Set<string>;
  computed: Set<string>;
};

export class Evaluator {
  constructor(
    private readonly sheet: Sheet,
    private readonly tables: Sheet[] = [sheet],
    private readonly visiting = new Set<string>(),
    private readonly cachePolicy?: EvalCachePolicy,
    private readonly parseAst?: (body: string) => Ast,
  ) {}

  evaluate(ast: Ast): FormulaValue {
    return this.visit(ast);
  }

  cellValue(ri: number, ci: number): FormulaValue {
    const key = `${sheetId(this.sheet)}:${ri},${ci}`;
    if (this.visiting.has(key)) {
      return errorValue("#CIRCLE!");
    }
    const cell = this.sheet.getCell(ri, ci);
    const text = cell?.text ?? "";
    if (!isFormula(text) || isTextFormat(this.sheet.getCellStyle(ri, ci).numFmt)) {
      if (text === "") {
        return "";
      }
      if (typeof cell?.value === "number" && Number.isFinite(cell.value)) {
        return cell.value;
      }
      const n = Number(text);
      return Number.isFinite(n) && text.trim() !== "" ? n : text;
    }
    if (this.cachePolicy && !this.cachePolicy.dirty.has(key) && cell?.value !== undefined) {
      return cachedFormulaValue(cell.value);
    }
    if (this.cachePolicy?.computed.has(key) && cell?.value !== undefined) {
      return cachedFormulaValue(cell.value);
    }
    this.visiting.add(key);
    try {
      const ast = this.parseAst ? this.parseAst(text.slice(1)) : new Parser(new Lexer(text.slice(1)).tokenize()).parse();
      const value = this.visit(ast);
      if (cell) {
        cell.value = stringifyValue(value);
      }
      this.cachePolicy?.computed.add(key);
      return value;
    } catch (error) {
      const code = error instanceof FormulaError ? error.code : "#VALUE!";
      if (cell) {
        cell.value = code;
      }
      this.cachePolicy?.computed.add(key);
      return errorValue(code);
    } finally {
      this.visiting.delete(key);
    }
  }

  argValues(ast: Ast): FormulaValue[] {
    if (ast.kind === "range") {
      return this.rangeValues(ast.start, ast.end, ast.sheet);
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
        return this.refValue(ast.value, ast.sheet);
      case "range":
        return errorValue("#VALUE!");
      case "unary": {
        const value = this.visit(ast.expr);
        if (isErrorValue(value)) return value;
        return -(asNumber(value) ?? 0);
      }
      case "binary": {
        const left = this.visit(ast.left);
        if (isErrorValue(left)) return left;
        const right = this.visit(ast.right);
        if (isErrorValue(right)) return right;
        return this.binary(ast.op, left, right);
      }
      case "call":
        return this.call(ast.name, ast.args);
    }
  }

  private refValue(ref: string, sheetName?: string): FormulaValue {
    if (ref === "#REF!") {
      return errorValue("#REF!");
    }
    const [ci, ri] = expr2xy(ref);
    const target = this.evaluatorFor(sheetName);
    if (!(target instanceof Evaluator)) return target;
    return target.cellValue(ri, ci);
  }

  private rangeValues(start: string, end: string, sheetName?: string): FormulaValue[] {
    if (start === "#REF!" || end === "#REF!") {
      return [errorValue("#REF!")];
    }
    const target = this.evaluatorFor(sheetName);
    if (!(target instanceof Evaluator)) return [target];
    const range = CellRange.valueOf(`${start}:${end}`);
    const values: FormulaValue[] = [];
    range.each((ri, ci) => {
      values.push(target.cellValue(ri, ci));
    });
    return values;
  }

  private evaluatorFor(sheetName?: string): Evaluator | FormulaErrorValue {
    if (!sheetName) {
      return this;
    }
    const target = findLocalSheet(this.tables, this.sheet, sheetName);
    if (!target) {
      return errorValue("#REF!");
    }
    if (target === this.sheet) {
      return this;
    }
    return new Evaluator(
      target,
      this.tables,
      this.visiting,
      this.cachePolicy,
      this.parseAst,
    );
  }

  private call(name: string, args: Ast[]): FormulaValue {
    if (name === "IF") return this.callIf(args);
    if (name === "IFS") return this.callIfs(args);
    if (name === "IFERROR") return this.callIfError(args);
    if (name === "IFNA") return this.callIfNa(args);
    if (name === "AND") return this.callAnd(args);
    if (name === "OR") return this.callOr(args);
    if (name === "SWITCH") return this.callSwitch(args);
    if (name === "CHOOSE") return this.callChoose(args);
    if (name === "SUMIF") return this.callSumIf(args);
    if (name === "SUMIFS") return this.callSumIfs(args);
    if (name === "COUNTIF") return this.callCountIf(args);
    if (name === "COUNTIFS") return this.callCountIfs(args);
    if (name === "AVERAGEIF") return this.callAverageIf(args);
    if (name === "INDEX") return this.callIndex(args);
    if (name === "MATCH") return this.callMatch(args);
    if (name === "VLOOKUP") return this.callVlookup(args);
    if (name === "XLOOKUP") return this.callXlookup(args);
    if (name === "GETPIVOTDATA") return this.callGetPivotData(args);
    const fn = FUNCTIONS[name];
    if (!fn) {
      return errorValue("#NAME?");
    }
    return fn(args.map((arg) => this.argValues(arg)));
  }

  private callGetPivotData(args: Ast[]): FormulaValue {
    if (args.length < 2) {
      return errorValue("#VALUE!");
    }
    const refRaw = this.scalar(args[0]);
    if (isErrorValue(refRaw)) {
      return refRaw;
    }
    const pairs: string[] = [];
    for (let i = 1; i < args.length; i += 1) {
      const value = this.scalar(args[i]);
      if (isErrorValue(value)) {
        return value;
      }
      pairs.push(value === null ? "" : String(value));
    }
    let query;
    try {
      query = parsePivotPairs(pairs);
    } catch (error) {
      if (error instanceof FormulaError) {
        return errorValue(error.code);
      }
      throw error;
    }
    const located = parseCrossCellRef(String(refRaw));
    const matches = findTables(this.tables, query.name, query.filters, located.sheet ?? query.sheet);
    const target = matches[0];
    if (!target) {
      return errorValue("#N/A");
    }
    const [ci, ri] = expr2xy(located.ref);
    if (!located.ref || ci < 0 || ri < 0) {
      return errorValue("#REF!");
    }
    const evaluator = target === this.sheet ? this : new Evaluator(
      target,
      this.tables,
      this.visiting,
      this.cachePolicy,
      this.parseAst,
    );
    return evaluator.cellValue(ri, ci);
  }

  private scalar(ast: Ast): FormulaValue {
    const values = this.argValues(ast);
    return values[0] ?? "";
  }

  private rangeMatrix(start: string, end: string, sheetName?: string): FormulaValue[][] {
    if (start === "#REF!" || end === "#REF!") {
      return [[errorValue("#REF!")]];
    }
    const target = this.evaluatorFor(sheetName);
    if (!(target instanceof Evaluator)) return [[target]];
    if (isColumnRef(start) || isColumnRef(end)) {
      const startCol = isColumnRef(start) ? indexAt(start) : expr2xy(start)[0];
      const endCol = isColumnRef(end) ? indexAt(end) : expr2xy(end)[0];
      const startRow = isColumnRef(start) ? 0 : expr2xy(start)[1];
      const endRow = isColumnRef(end) ? usedMaxRow(target.sheet) : expr2xy(end)[1];
      return this.fillMatrix(target, startRow, endRow, startCol, endCol);
    }
    const range = CellRange.valueOf(`${start}:${end}`);
    const grid: FormulaValue[][] = [];
    for (let ri = range.sri; ri <= range.eri; ri += 1) {
      const row: FormulaValue[] = [];
      for (let ci = range.sci; ci <= range.eci; ci += 1) {
        row.push(target.cellValue(ri, ci));
      }
      grid.push(row);
    }
    return grid;
  }

  private fillMatrix(target: Evaluator, startRow: number, endRow: number, startCol: number, endCol: number): FormulaValue[][] {
    const grid: FormulaValue[][] = [];
    for (let ri = Math.min(startRow, endRow); ri <= Math.max(startRow, endRow); ri += 1) {
      const row: FormulaValue[] = [];
      for (let ci = Math.min(startCol, endCol); ci <= Math.max(startCol, endCol); ci += 1) {
        row.push(target.cellValue(ri, ci));
      }
      grid.push(row);
    }
    return grid;
  }

  private argMatrix(ast: Ast): FormulaValue[][] {
    if (ast.kind === "range") {
      return this.rangeMatrix(ast.start, ast.end, ast.sheet);
    }
    return [[this.visit(ast)]];
  }

  private callIf(args: Ast[]): FormulaValue {
    if (!args.length) return errorValue("#VALUE!");
    const cond = this.scalar(args[0]);
    if (isErrorValue(cond)) return cond;
    const bit = excelLogical(cond);
    if (isErrorValue(bit)) return bit;
    if (bit) return args[1] !== undefined ? this.scalar(args[1]) : false;
    return args[2] !== undefined ? this.scalar(args[2]) : false;
  }

  private callIfs(args: Ast[]): FormulaValue {
    if (args.length < 2) return errorValue("#N/A");
    for (let i = 0; i + 1 < args.length; i += 2) {
      const cond = this.scalar(args[i]);
      if (isErrorValue(cond)) return cond;
      const bit = excelLogical(cond);
      if (isErrorValue(bit)) return bit;
      if (bit) return this.scalar(args[i + 1]);
    }
    return errorValue("#N/A");
  }

  private callIfError(args: Ast[]): FormulaValue {
    if (!args.length) return errorValue("#VALUE!");
    const value = this.scalar(args[0]);
    if (!isErrorValue(value)) return value;
    return args[1] !== undefined ? this.scalar(args[1]) : 0;
  }

  private callIfNa(args: Ast[]): FormulaValue {
    if (!args.length) return errorValue("#VALUE!");
    const value = this.scalar(args[0]);
    if (isErrorValue(value) && value.error === "#N/A") {
      return args[1] !== undefined ? this.scalar(args[1]) : 0;
    }
    return value;
  }

  private callAnd(args: Ast[]): FormulaValue {
    if (!args.length) return errorValue("#VALUE!");
    let result = true;
    for (const arg of args) {
      for (const item of this.argValues(arg)) {
        if (isErrorValue(item)) return item;
        const bit = excelLogical(item);
        if (isErrorValue(bit)) return bit;
        if (!bit) result = false;
      }
    }
    return result;
  }

  private callOr(args: Ast[]): FormulaValue {
    if (!args.length) return errorValue("#VALUE!");
    let result = false;
    for (const arg of args) {
      for (const item of this.argValues(arg)) {
        if (isErrorValue(item)) return item;
        const bit = excelLogical(item);
        if (isErrorValue(bit)) return bit;
        if (bit) result = true;
      }
    }
    return result;
  }

  private callSwitch(args: Ast[]): FormulaValue {
    if (args.length < 3) return errorValue("#N/A");
    const expr = this.scalar(args[0]);
    if (isErrorValue(expr)) return expr;
    for (let i = 1; i + 1 < args.length; i += 2) {
      const candidate = this.scalar(args[i]);
      if (isErrorValue(candidate)) return candidate;
      if (compareLookup(expr, candidate) === 0) return this.scalar(args[i + 1]);
    }
    if (args.length % 2 === 0) return this.scalar(args[args.length - 1]);
    return errorValue("#N/A");
  }

  private callChoose(args: Ast[]): FormulaValue {
    if (args.length < 2) return errorValue("#VALUE!");
    const index = Math.trunc(toNumber(this.scalar(args[0])) ?? 0);
    if (index < 1 || index >= args.length) return errorValue("#VALUE!");
    return this.scalar(args[index]);
  }

  private callSumIf(args: Ast[]): FormulaValue {
    if (args.length < 2) return errorValue("#VALUE!");
    const range = this.argValues(args[0]);
    const criteria = this.scalar(args[1]);
    if (isErrorValue(criteria)) return criteria;
    const sums = args[2] ? this.argValues(args[2]) : range;
    let total = 0;
    const n = Math.min(range.length, sums.length);
    for (let i = 0; i < n; i += 1) {
      if (!matchCriteria(range[i], criteria)) continue;
      const num = toNumber(sums[i]);
      if (num !== null) total += num;
    }
    return total;
  }

  private callSumIfs(args: Ast[]): FormulaValue {
    if (args.length < 3 || args.length % 2 === 0) return errorValue("#VALUE!");
    const sums = this.argValues(args[0]);
    const criteriaRanges: FormulaValue[][] = [];
    const criteria: FormulaValue[] = [];
    for (let i = 1; i < args.length; i += 2) {
      criteriaRanges.push(this.argValues(args[i]));
      const item = this.scalar(args[i + 1]);
      if (isErrorValue(item)) return item;
      criteria.push(item);
    }
    const n = Math.min(sums.length, ...criteriaRanges.map((item) => item.length));
    let total = 0;
    for (let i = 0; i < n; i += 1) {
      if (!criteriaRanges.every((range, idx) => matchCriteria(range[i], criteria[idx]))) continue;
      const num = toNumber(sums[i]);
      if (num !== null) total += num;
    }
    return total;
  }

  private callCountIf(args: Ast[]): FormulaValue {
    if (args.length < 2) return errorValue("#VALUE!");
    const range = this.argValues(args[0]);
    const criteria = this.scalar(args[1]);
    if (isErrorValue(criteria)) return criteria;
    return range.filter((item) => matchCriteria(item, criteria)).length;
  }

  private callCountIfs(args: Ast[]): FormulaValue {
    if (args.length < 2 || args.length % 2 !== 0) return errorValue("#VALUE!");
    const ranges: FormulaValue[][] = [];
    const criteria: FormulaValue[] = [];
    for (let i = 0; i < args.length; i += 2) {
      ranges.push(this.argValues(args[i]));
      const item = this.scalar(args[i + 1]);
      if (isErrorValue(item)) return item;
      criteria.push(item);
    }
    const n = Math.min(...ranges.map((item) => item.length));
    let count = 0;
    for (let i = 0; i < n; i += 1) {
      if (ranges.every((range, idx) => matchCriteria(range[i], criteria[idx]))) count += 1;
    }
    return count;
  }

  private callAverageIf(args: Ast[]): FormulaValue {
    if (args.length < 2) return errorValue("#VALUE!");
    const range = this.argValues(args[0]);
    const criteria = this.scalar(args[1]);
    if (isErrorValue(criteria)) return criteria;
    const avgs = args[2] ? this.argValues(args[2]) : range;
    let total = 0;
    let count = 0;
    const n = Math.min(range.length, avgs.length);
    for (let i = 0; i < n; i += 1) {
      if (!matchCriteria(range[i], criteria)) continue;
      const num = toNumber(avgs[i]);
      if (num === null) continue;
      total += num;
      count += 1;
    }
    return count === 0 ? errorValue("#DIV/0!") : total / count;
  }

  private callIndex(args: Ast[]): FormulaValue {
    if (args.length < 2) return errorValue("#VALUE!");
    const grid = this.argMatrix(args[0]);
    const row = Math.trunc(toNumber(this.scalar(args[1])) ?? 0);
    const colArg = args[2] !== undefined ? Math.trunc(toNumber(this.scalar(args[2])) ?? 0) : 0;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    let ri = row;
    let ci = colArg;
    if (cols === 1 && args[2] === undefined) {
      ci = 1;
    } else if (rows === 1 && args[2] === undefined) {
      ci = row;
      ri = 1;
    }
    if (ri < 1 || ci < 1 || ri > rows || ci > cols) return errorValue("#REF!");
    return grid[ri - 1]?.[ci - 1] ?? errorValue("#REF!");
  }

  private callMatch(args: Ast[]): FormulaValue {
    if (args.length < 2) return errorValue("#N/A");
    const lookup = this.scalar(args[0]);
    if (isErrorValue(lookup)) return lookup;
    const vector = this.argValues(args[1]);
    const type = args[2] !== undefined ? (toNumber(this.scalar(args[2])) ?? 1) : 1;
    if (type === 0) {
      const index = vector.findIndex((item) => compareLookup(item, lookup) === 0);
      return index < 0 ? errorValue("#N/A") : index + 1;
    }
    let found = -1;
    if (type > 0) {
      for (let i = 0; i < vector.length; i += 1) {
        if (compareLookup(vector[i], lookup) <= 0) found = i;
        else break;
      }
    } else {
      for (let i = 0; i < vector.length; i += 1) {
        if (compareLookup(vector[i], lookup) >= 0) found = i;
        else break;
      }
    }
    return found < 0 ? errorValue("#N/A") : found + 1;
  }

  private callVlookup(args: Ast[]): FormulaValue {
    if (args.length < 3) return errorValue("#N/A");
    const lookup = this.scalar(args[0]);
    if (isErrorValue(lookup)) return lookup;
    const grid = this.argMatrix(args[1]);
    const col = Math.trunc(toNumber(this.scalar(args[2])) ?? 0);
    const approx = args[3] === undefined ? true : excelLogical(this.scalar(args[3]));
    if (isErrorValue(approx)) return approx;
    if (col < 1 || !grid[0] || col > grid[0].length) return errorValue("#REF!");
    if (!approx) {
      const row = grid.find((item) => compareLookup(item[0], lookup) === 0);
      return row ? (row[col - 1] ?? errorValue("#N/A")) : errorValue("#N/A");
    }
    let found: FormulaValue[] | undefined;
    for (const row of grid) {
      if (compareLookup(row[0], lookup) <= 0) found = row;
      else break;
    }
    return found ? (found[col - 1] ?? errorValue("#N/A")) : errorValue("#N/A");
  }

  private callXlookup(args: Ast[]): FormulaValue {
    if (args.length < 3) return errorValue("#N/A");
    const lookup = this.scalar(args[0]);
    if (isErrorValue(lookup)) return lookup;
    const keys = this.argValues(args[1]);
    const values = this.argValues(args[2]);
    const index = keys.findIndex((item) => compareLookup(item, lookup) === 0);
    if (index < 0) return errorValue("#N/A");
    return values[index] ?? errorValue("#N/A");
  }

  private binary(
    op: "+" | "-" | "*" | "/" | "&" | "=" | "<>" | ">" | ">=" | "<" | "<=",
    left: FormulaValue,
    right: FormulaValue,
  ): FormulaValue {
    if (op === "&") {
      if (isErrorValue(left)) {
        return left;
      }
      if (isErrorValue(right)) {
        return right;
      }
      return `${excelConcatText(left)}${excelConcatText(right)}`;
    }
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
        return errorValue("#VALUE!");
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
    const a = asNumber(left);
    const b = asNumber(right);
    if (a === null || b === null) {
      return errorValue("#VALUE!");
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
      return errorValue("#DIV/0!");
    }
    return a / b;
  }
}

export function cellEvalKey(sheet: Sheet, ri: number, ci: number): string {
  return `${sheetId(sheet)}:${ri},${ci}`;
}

export function cachedFormulaValue(raw: string | number): FormulaValue {
  if (typeof raw === "number") {
    return raw;
  }
  if (raw === "TRUE") {
    return true;
  }
  if (raw === "FALSE") {
    return false;
  }
  if (raw.startsWith("#") && raw.endsWith("!")) {
    return errorValue(raw);
  }
  return raw;
}

export function stringifyValue(value: FormulaValue): string | number {
  if (isErrorValue(value)) {
    return value.error;
  }
  if (value === null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return value;
}

function isColumnRef(ref: string): boolean {
  return /^[A-Z]+$/i.test(ref.trim());
}

function usedMaxRow(sheet: Sheet): number {
  let maxRow = 0;
  sheet.rows.each((ri, row) => {
    if (row.cells && Object.keys(row.cells).length > 0 && ri > maxRow) maxRow = ri;
  });
  return maxRow;
}

function findLocalSheet(tables: Sheet[], current: Sheet, name: string): Sheet | undefined {
  const key = name.trim().toLowerCase();
  return tables.find(
    (item) => item.table === current.table && item.name.trim().toLowerCase() === key,
  );
}

function excelConcatText(value: FormulaValue): string {
  if (value === null || value === "") {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return String(value);
}

function asNumber(value: FormulaValue): number | null {
  if (isErrorValue(value)) {
    return null;
  }
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
