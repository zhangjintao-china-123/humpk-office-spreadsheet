import { cloneCell, isFormula, type Cell } from "../model/Cell";
import type { CellRange } from "../model/CellRange";
import { CellRange as Range } from "../model/CellRange";
import { formulaBarDateText, looksLikeDateFormat } from "../model/NumberFormat";
import type { Sheet } from "../model/Sheet";
import { rewriteFormulaRef } from "../formula/formulaEdit";
import { scanFormulaRefs } from "../formula/formulaRefs";
import type { FillAxis } from "../selection/FillHandle";

export function translateFormula(text: string, dRow: number, dCol: number, sheetName: string): string {
  if (!text.startsWith("=") || (dRow === 0 && dCol === 0)) {
    return text;
  }
  let next = text;
  const refs = scanFormulaRefs(next, sheetName);
  for (let i = refs.length - 1; i >= 0; i -= 1) {
    const ref = refs[i];
    const sri = ref.startAbs.row ? ref.range.sri : ref.range.sri + dRow;
    const sci = ref.startAbs.col ? ref.range.sci : ref.range.sci + dCol;
    const eri = ref.endAbs.row ? ref.range.eri : ref.range.eri + dRow;
    const eci = ref.endAbs.col ? ref.range.eci : ref.range.eci + dCol;
    if (sri < 0 || sci < 0 || eri < 0 || eci < 0) {
      const sheet = ref.raw.includes("!") ? ref.raw.slice(0, ref.raw.lastIndexOf("!") + 1) : "";
      next = `${next.slice(0, ref.start)}${sheet}#REF!${next.slice(ref.end)}`;
      continue;
    }
    const shifted = rewriteFormulaRef(next, ref, new Range(sri, sci, eri, eci));
    next = shifted.text;
  }
  return next;
}

export function filledCell(
  sheet: Sheet,
  source: CellRange,
  ri: number,
  ci: number,
  axis: FillAxis,
): Cell | undefined {
  if (source.includes(ri, ci)) {
    return cloneCell(sheet.getCell(ri, ci));
  }
  const line = sourceLine(sheet, source, axis === "vertical" ? ci : ri, axis);
  const series = detectSeries(line);
  if (series) {
    const sign = fillSign(source, ri, ci, axis);
    const distance = fillDistance(source, ri, ci, axis);
    return seriesCell(series.last, series.step * sign * distance);
  }
  const tails = detectTailSeries(line);
  if (tails) {
    const sign = fillSign(source, ri, ci, axis);
    const distance = fillDistance(source, ri, ci, axis);
    const n = tails.last + tails.step * sign * distance;
    const next = cloneCell(line[line.length - 1]?.cell) ?? {};
    delete next.merge;
    next.text = `${tails.prefix}${String(n).padStart(tails.width, "0")}`;
    delete next.value;
    return next;
  }
  const srcH = source.rowCount();
  const srcW = source.colCount();
  const srcRi = axis === "vertical" ? source.sri + mod(ri - source.sri, srcH) : ri;
  const srcCi = axis === "horizontal" ? source.sci + mod(ci - source.sci, srcW) : ci;
  const src = cloneCell(sheet.getCell(srcRi, srcCi));
  if (!src) {
    return undefined;
  }
  delete src.merge;
  if (src.text && isFormula(src.text)) {
    src.text = translateFormula(src.text, ri - srcRi, ci - srcCi, sheet.name);
    delete src.value;
  }
  return src;
}

type LineCell = {
  cell: Cell | undefined;
  styleFmt?: string;
};

type NumberSeries = {
  last: LineCell;
  step: number;
};

function sourceLine(sheet: Sheet, source: CellRange, index: number, axis: FillAxis): LineCell[] {
  const line: LineCell[] = [];
  if (axis === "vertical") {
    for (let ri = source.sri; ri <= source.eri; ri += 1) {
      line.push({ cell: sheet.getCell(ri, index), styleFmt: sheet.getCellStyle(ri, index).numFmt });
    }
  } else {
    for (let ci = source.sci; ci <= source.eci; ci += 1) {
      line.push({ cell: sheet.getCell(index, ci), styleFmt: sheet.getCellStyle(index, ci).numFmt });
    }
  }
  return line;
}

function detectSeries(line: LineCell[]): NumberSeries | undefined {
  if (!line.length) {
    return undefined;
  }
  const numbers: number[] = [];
  for (const item of line) {
    if (isFormula(item.cell?.text)) {
      return undefined;
    }
    const value = numericValue(item.cell);
    if (value === undefined) {
      return undefined;
    }
    numbers.push(value);
  }
  const last = line[line.length - 1];
  if (numbers.length === 1) {
    return { last, step: defaultStep(last.styleFmt) };
  }
  return { last, step: (numbers[numbers.length - 1] - numbers[0]) / (numbers.length - 1) };
}

function defaultStep(fmt?: string): number {
  if ((fmt ?? "").includes("%")) {
    return 0.01;
  }
  if (looksLikeDateFormat(fmt)) {
    return 1;
  }
  return 1;
}

function numericValue(cell: Cell | undefined): number | undefined {
  if (!cell) {
    return undefined;
  }
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return cell.value;
  }
  const text = (cell.text ?? "").trim();
  if (!text || isFormula(text)) {
    return undefined;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

function seriesCell(last: LineCell, delta: number): Cell {
  const base = cloneCell(last.cell) ?? {};
  delete base.merge;
  const next = (numericValue(last.cell) ?? 0) + delta;
  base.value = next;
  if (looksLikeDateFormat(last.styleFmt)) {
    base.text = formulaBarDateText(next);
  } else if ((last.styleFmt ?? "").includes("%")) {
    base.text = `${Number((next * 100).toFixed(10))}%`;
  } else {
    base.text = String(next);
  }
  return base;
}

function detectTailSeries(line: LineCell[]): { prefix: string; last: number; step: number; width: number } | undefined {
  if (!line.length) {
    return undefined;
  }
  const parsed = line.map((item) => parseTail(item.cell?.text));
  if (parsed.some((item) => !item)) {
    return undefined;
  }
  const tails = parsed as Array<{ prefix: string; n: number; width: number }>;
  const prefix = tails[0].prefix;
  if (tails.some((item) => item.prefix !== prefix)) {
    return undefined;
  }
  const last = tails[tails.length - 1];
  const step = tails.length === 1 ? 1 : (last.n - tails[0].n) / (tails.length - 1);
  if (!Number.isInteger(step)) {
    return undefined;
  }
  return { prefix, last: last.n, step, width: last.width };
}

function parseTail(text: string | undefined): { prefix: string; n: number; width: number } | undefined {
  const raw = text ?? "";
  if (!raw || isFormula(raw)) {
    return undefined;
  }
  const match = raw.match(/^(.*?)(\d+)$/);
  if (!match) {
    return undefined;
  }
  return { prefix: match[1], n: Number(match[2]), width: match[2].length };
}

function fillSign(source: CellRange, ri: number, ci: number, axis: FillAxis): number {
  if (axis === "vertical") {
    return ri >= source.sri ? 1 : -1;
  }
  return ci >= source.sci ? 1 : -1;
}

function fillDistance(source: CellRange, ri: number, ci: number, axis: FillAxis): number {
  if (axis === "vertical") {
    return ri > source.eri ? ri - source.eri : source.sri - ri;
  }
  return ci > source.eci ? ci - source.eci : source.sci - ci;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}
