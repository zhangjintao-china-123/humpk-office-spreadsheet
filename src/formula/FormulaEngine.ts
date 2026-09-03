import { isFormula } from "../model/Cell";
import type { Sheet } from "../model/Sheet";
import { Evaluator, FormulaError, stringifyValue } from "./Evaluator";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";

export class FormulaEngine {
  recalculate(sheet: Sheet): void {
    const evaluator = new Evaluator(sheet);
    sheet.rows.each((ri, row) => {
      if (!row.cells) {
        return;
      }
      for (const [key, cell] of Object.entries(row.cells)) {
        if (!isFormula(cell.text)) {
          if (cell.text !== undefined) {
            const n = Number(cell.text);
            cell.value = Number.isFinite(n) && cell.text.trim() !== "" ? n : cell.text;
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

  evaluateText(sheet: Sheet, text: string): string | number {
    if (!isFormula(text)) {
      const n = Number(text);
      return Number.isFinite(n) && text.trim() !== "" ? n : text;
    }
    try {
      const ast = new Parser(new Lexer(text.slice(1)).tokenize()).parse();
      return stringifyValue(new Evaluator(sheet).evaluate(ast));
    } catch (error) {
      return error instanceof FormulaError ? error.code : "#VALUE!";
    }
  }
}
