export class FormulaError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "FormulaError";
  }
}
