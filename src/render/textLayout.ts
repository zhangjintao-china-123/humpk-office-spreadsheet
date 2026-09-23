import { styleFontCss, type CellStyle } from "../model/CellStyle";
import { CELL_PAD, DEFAULT_ROW_HEIGHT, PT_TO_PX } from "../shared/constants";

export type TextMeasurer = { measureText(text: string): number };

export function splitParagraphs(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

export function hasExplicitBreak(text: string): boolean {
  return /[\r\n]/.test(text);
}

export function wrapLines(measure: TextMeasurer, text: string, maxWidth: number, wrapWidth = true): string[] {
  const lines: string[] = [];
  for (const paragraph of splitParagraphs(text)) {
    if (!wrapWidth) {
      lines.push(paragraph);
      continue;
    }
    let current = "";
    for (const ch of paragraph) {
      const next = current + ch;
      if (current && measure.measureText(next) > maxWidth) {
        lines.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

export function cellLineHeight(style: Pick<CellStyle, "font">): number {
  return (style.font?.size ?? 10) * PT_TO_PX + 2;
}

export function wrappedBlockHeight(lineCount: number, style: Pick<CellStyle, "font">): number {
  return Math.max(DEFAULT_ROW_HEIGHT, CELL_PAD * 2 + lineCount * cellLineHeight(style));
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

export function measurerForStyle(style: CellStyle): TextMeasurer {
  const font = styleFontCss(style);
  if (typeof document === "undefined") {
    return { measureText: (text) => [...text].length * 7 };
  }
  if (measureCtx === undefined) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  const ctx = measureCtx;
  if (!ctx) {
    return { measureText: (text) => [...text].length * 7 };
  }
  return {
    measureText(text: string) {
      ctx.font = font;
      return ctx.measureText(text).width;
    },
  };
}
