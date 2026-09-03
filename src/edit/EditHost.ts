import type { FormulaEngine } from "../formula/FormulaEngine";
import type { Sheet } from "../model/Sheet";

export interface EditHost {
  sheet(): Sheet;
  engine(): FormulaEngine;
  afterChange(): void;
}
