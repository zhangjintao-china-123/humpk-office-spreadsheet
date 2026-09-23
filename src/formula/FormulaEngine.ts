import { isFormula } from "../model/Cell";
import { syncLiteralValue } from "../model/InputParse";
import { isTextFormat } from "../model/NumberFormat";
import type { Sheet } from "../model/Sheet";
import type { Workbook } from "../model/Workbook";
import { collectFormulaPrecedents, refreshLiteralValue, resolveDepSheet, type RangeWatch } from "./deps";
import type { Ast } from "./Ast";
import { cellEvalKey, Evaluator, FormulaError, stringifyValue } from "./Evaluator";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";

export type RecalcOrigin = {
  sheet: Sheet;
  ri: number;
  ci: number;
};

type FormulaLoc = RecalcOrigin;

export class FormulaEngine {
  workbook?: Workbook;
  lastDirtyCount = 0;

  private graphReady = false;
  private readonly dependents = new Map<string, Set<string>>();
  private readonly formulaLocs = new Map<string, FormulaLoc>();
  private readonly formulaPrecedents = new Map<string, { points: string[]; ranges: RangeWatch[] }>();
  private rangeWatchers: RangeWatch[] = [];
  private readonly astCache = new Map<string, Ast>();

  attach(workbook: Workbook | undefined): void {
    this.workbook = workbook;
    this.invalidateGraph();
  }

  recalculate(sheet: Sheet): void {
    this.rebuildGraph();
    this.recalculateSheets(this.allTables(sheet), undefined);
    this.lastDirtyCount = -1;
  }

  recalculateAt(origins: RecalcOrigin[]): void {
    if (!origins.length) {
      return;
    }
    if (!this.graphReady) {
      this.recalculate(origins[0].sheet);
      return;
    }
    const dirty = new Set<string>();
    for (const origin of origins) {
      this.bindFormula(origin.sheet, origin.ri, origin.ci);
      this.markDirtyFrom(origin.sheet, origin.ri, origin.ci, dirty);
    }
    this.lastDirtyCount = dirty.size;
    for (const origin of origins) {
      refreshLiteralValue(origin.sheet, origin.ri, origin.ci);
    }
    this.recalculateSheets(this.allTables(origins[0].sheet), dirty);
  }

  evaluateText(sheet: Sheet, text: string): string | number {
    if (!isFormula(text)) {
      const n = Number(text);
      return Number.isFinite(n) && text.trim() !== "" ? n : text;
    }
    try {
      const ast = this.parseBody(text.slice(1));
      return stringifyValue(this.evaluator(sheet, this.allTables(sheet)).evaluate(ast));
    } catch (error) {
      return error instanceof FormulaError ? error.code : "#VALUE!";
    }
  }

  private allTables(fallback: Sheet): Sheet[] {
    return this.workbook?.sheets?.length ? this.workbook.sheets : [fallback];
  }

  private evaluator(
    sheet: Sheet,
    tables: Sheet[],
    visiting = new Set<string>(),
    dirty?: Set<string>,
  ): Evaluator {
    const policy = dirty
      ? { dirty, computed: new Set<string>() }
      : undefined;
    return new Evaluator(
      sheet,
      tables,
      visiting,
      policy,
      (body) => this.parseBody(body),
    );
  }

  private parseBody(body: string): Ast {
    const cached = this.astCache.get(body);
    if (cached) {
      return cached;
    }
    const ast = new Parser(new Lexer(body).tokenize()).parse();
    this.astCache.set(body, ast);
    return ast;
  }

  private recalculateSheets(tables: Sheet[], dirty: Set<string> | undefined): void {
    const visiting = new Set<string>();
    if (dirty) {
      for (const key of dirty) {
        const loc = this.formulaLocs.get(key);
        if (!loc) {
          continue;
        }
        try {
          this.evaluator(loc.sheet, tables, visiting, dirty).cellValue(loc.ri, loc.ci);
        } catch (error) {
          const cell = loc.sheet.getCell(loc.ri, loc.ci);
          if (cell) {
            cell.value = error instanceof FormulaError ? error.code : "#VALUE!";
          }
        }
      }
      return;
    }
    for (const sheet of tables) {
      this.recalculateSheet(sheet, tables, visiting);
    }
  }

  private recalculateSheet(sheet: Sheet, tables: Sheet[], visiting: Set<string>): void {
    const evaluator = this.evaluator(sheet, tables, visiting);
    sheet.rows.each((ri, row) => {
      if (!row.cells) {
        return;
      }
      for (const [key, cell] of Object.entries(row.cells)) {
        if (!isFormula(cell.text) || isTextFormat(sheet.getCellStyle(ri, Number(key)).numFmt)) {
          if (cell.text !== undefined) {
            syncLiteralValue(cell, sheet.getCellStyle(ri, Number(key)).numFmt);
          } else {
            delete cell.value;
          }
          continue;
        }
        try {
          evaluator.cellValue(ri, Number(key));
        } catch (error) {
          cell.value = error instanceof FormulaError ? error.code : "#VALUE!";
        }
      }
    });
  }

  private invalidateGraph(): void {
    this.graphReady = false;
    this.dependents.clear();
    this.formulaLocs.clear();
    this.formulaPrecedents.clear();
    this.rangeWatchers = [];
  }

  private rebuildGraph(): void {
    this.invalidateGraph();
    const sheets = this.workbook?.sheets ?? [];
    for (const sheet of sheets) {
      sheet.rows.each((ri, row) => {
        if (!row.cells) {
          return;
        }
        for (const [key, cell] of Object.entries(row.cells)) {
          if (!isFormula(cell.text) || isTextFormat(sheet.getCellStyle(ri, Number(key)).numFmt)) {
            continue;
          }
          this.bindFormula(sheet, ri, Number(key));
        }
      });
    }
    this.graphReady = true;
  }

  private bindFormula(sheet: Sheet, ri: number, ci: number): void {
    const key = cellEvalKey(sheet, ri, ci);
    this.unbindFormula(key);
    const text = sheet.getCell(ri, ci)?.text ?? "";
    if (!isFormula(text) || isTextFormat(sheet.getCellStyle(ri, ci).numFmt)) {
      return;
    }
    const sheets = this.workbook?.sheets ?? [sheet];
    const points: string[] = [];
    const ranges: RangeWatch[] = [];
    for (const precedent of collectFormulaPrecedents(text)) {
      const target = resolveDepSheet(sheets, sheet, precedent.sheetName);
      if (!target) {
        continue;
      }
      if (precedent.kind === "point") {
        const point = cellEvalKey(target, precedent.ri, precedent.ci);
        points.push(point);
        let bucket = this.dependents.get(point);
        if (!bucket) {
          bucket = new Set();
          this.dependents.set(point, bucket);
        }
        bucket.add(key);
        continue;
      }
      const watch: RangeWatch = {
        sheet: target,
        sri: precedent.sri,
        sci: precedent.sci,
        eri: precedent.eri,
        eci: precedent.eci,
        formulaKey: key,
      };
      ranges.push(watch);
      this.rangeWatchers.push(watch);
    }
    this.formulaLocs.set(key, { sheet, ri, ci });
    this.formulaPrecedents.set(key, { points, ranges });
  }

  private unbindFormula(key: string): void {
    const prev = this.formulaPrecedents.get(key);
    if (!prev) {
      this.formulaLocs.delete(key);
      return;
    }
    for (const point of prev.points) {
      this.dependents.get(point)?.delete(key);
    }
    if (prev.ranges.length) {
      this.rangeWatchers = this.rangeWatchers.filter((item) => item.formulaKey !== key);
    }
    this.formulaPrecedents.delete(key);
    this.formulaLocs.delete(key);
  }

  private markDirtyFrom(sheet: Sheet, ri: number, ci: number, dirty: Set<string>): void {
    const queue = [cellEvalKey(sheet, ri, ci)];
    for (const watch of this.rangeWatchers) {
      if (watch.sheet !== sheet || ri < watch.sri || ri > watch.eri || ci < watch.sci || ci > watch.eci) {
        continue;
      }
      queue.push(watch.formulaKey);
    }
    while (queue.length) {
      const key = queue.pop()!;
      if (dirty.has(key)) {
        continue;
      }
      dirty.add(key);
      const next = this.dependents.get(key);
      if (!next) {
        continue;
      }
      for (const item of next) {
        queue.push(item);
      }
    }
  }
}
