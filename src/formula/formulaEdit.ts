import { CellRange } from "../model/CellRange";
import type { ImageHandle } from "../model/SheetImage";
import { formatFormulaRange, scanFormulaRefs, type FormulaRef } from "./formulaRefs";

export type FormulaEditMode = "point" | "edit";
export type FormulaEditSource = "bar" | "cell";

export type FormulaEditState = {
  source: FormulaEditSource;
  mode: FormulaEditMode;
  anchorRi: number;
  anchorCi: number;
  text: string;
  cursor: number;
  activeStart?: number;
};

export function isFormulaText(text: string): boolean {
  return text.trimStart().startsWith("=");
}

export function applyPointRef(
  state: FormulaEditState,
  range: CellRange,
  currentSheet: string,
): FormulaEditState {
  const text = ensureEquals(state.text);
  const cursor = Math.min(Math.max(0, state.cursor + (text.length - state.text.length)), text.length);
  const refs = scanFormulaRefs(text, currentSheet);
  const target = findReplaceTarget(refs, cursor, state.activeStart);
  const token = formatFormulaRange(range, target?.startAbs, target?.endAbs);
  if (target) {
    return {
      ...state,
      text: `${text.slice(0, target.start)}${token}${text.slice(target.end)}`,
      cursor: target.start + token.length,
      activeStart: target.start,
      mode: "point",
    };
  }
  const insertAt = insertionIndex(text, cursor);
  return {
    ...state,
    text: `${text.slice(0, insertAt)}${token}${text.slice(insertAt)}`,
    cursor: insertAt + token.length,
    activeStart: insertAt,
    mode: "point",
  };
}

export function rewriteFormulaRef(text: string, ref: FormulaRef, range: CellRange): { text: string; cursor: number } {
  const token = formatFormulaRange(range, ref.startAbs, ref.endAbs);
  const sheet = ref.raw.includes("!") ? ref.raw.slice(0, ref.raw.lastIndexOf("!") + 1) : "";
  const next = `${text.slice(0, ref.start)}${sheet}${token}${text.slice(ref.end)}`;
  return { text: next, cursor: ref.start + sheet.length + token.length };
}

export function resizeFormulaRange(range: CellRange, handle: ImageHandle, ri: number, ci: number): CellRange {
  let { sri, sci, eri, eci } = range;
  if (handle.includes("n")) {
    sri = ri;
  }
  if (handle.includes("s")) {
    eri = ri;
  }
  if (handle.includes("w")) {
    sci = ci;
  }
  if (handle.includes("e")) {
    eci = ci;
  }
  if (handle === "n" || handle === "s") {
    /* keep cols */
  }
  return new CellRange(sri, sci, eri, eci);
}

export function nudgeFormulaRange(range: CellRange, dri: number, dci: number, extend: boolean): CellRange {
  if (extend) {
    return new CellRange(range.sri, range.sci, range.eri + dri, range.eci + dci);
  }
  return new CellRange(range.sri + dri, range.sci + dci, range.eri + dri, range.eci + dci);
}

export function refAtCursor(refs: FormulaRef[], cursor: number, activeStart?: number): FormulaRef | undefined {
  return findReplaceTarget(refs, cursor, activeStart);
}

function findReplaceTarget(refs: FormulaRef[], cursor: number, activeStart?: number): FormulaRef | undefined {
  const inside = refs.find((ref) => cursor >= ref.start && cursor <= ref.end);
  if (inside) {
    return inside;
  }
  if (activeStart === undefined) {
    return undefined;
  }
  return refs.find((ref) => ref.start === activeStart);
}

function insertionIndex(text: string, cursor: number): number {
  const clipped = Math.min(Math.max(0, cursor), text.length);
  if (clipped === 0 && !text.startsWith("=")) {
    return 0;
  }
  return clipped;
}

function ensureEquals(text: string): string {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("=")) {
    return text.startsWith("=") ? text : `=${trimmed.slice(1)}`;
  }
  if (!text) {
    return "=";
  }
  return `=${text}`;
}
