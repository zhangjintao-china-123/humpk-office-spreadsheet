export type FormulaValue = string | number | boolean | null;

export type FormulaFn = (args: FormulaValue[][]) => FormulaValue;

function flatten(groups: FormulaValue[][]): FormulaValue[] {
  return groups.flat();
}

function numbers(groups: FormulaValue[][]): number[] {
  return flatten(groups)
    .map(toNumber)
    .filter((value): value is number => value !== null);
}

function toNumber(value: FormulaValue): number | null {
  if (value === null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function truthy(value: FormulaValue): boolean {
  if (value === null || value === "" || value === 0 || value === false) {
    return false;
  }
  return true;
}

export const FUNCTIONS: Record<string, FormulaFn> = {
  SUM(args) {
    return numbers(args).reduce((a, b) => a + b, 0);
  },
  AVERAGE(args) {
    const list = numbers(args);
    return list.length === 0 ? 0 : list.reduce((a, b) => a + b, 0) / list.length;
  },
  MAX(args) {
    const list = numbers(args);
    return list.length === 0 ? 0 : Math.max(...list);
  },
  MIN(args) {
    const list = numbers(args);
    return list.length === 0 ? 0 : Math.min(...list);
  },
  IF(args) {
    const flat = flatten(args);
    return truthy(flat[0] ?? null) ? (flat[1] ?? true) : (flat[2] ?? false);
  },
  AND(args) {
    return flatten(args).every((item) => truthy(item));
  },
  OR(args) {
    return flatten(args).some((item) => truthy(item));
  },
  CONCAT(args) {
    return flatten(args).map((item) => (item === null ? "" : String(item))).join("");
  },
};
