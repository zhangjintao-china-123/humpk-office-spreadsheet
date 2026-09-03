const THEME = ["#ffffff", "#000100", "#e7e5e6", "#445569", "#5b9cd6", "#ed7d31", "#a5a5a5", "#ffc001", "#4371c6", "#71ae47"];

const INDEXED: Record<number, string> = {
  0: "#000000",
  1: "#ffffff",
  2: "#ff0000",
  3: "#00ff00",
  4: "#0000ff",
  5: "#ffff00",
  6: "#ff00ff",
  7: "#00ffff",
  8: "#000000",
  9: "#ffffff",
  10: "#ff0000",
  11: "#00ff00",
  12: "#0000ff",
  13: "#ffff00",
  14: "#ff00ff",
  15: "#00ffff",
  16: "#800000",
  17: "#008000",
  18: "#000080",
  22: "#c0c0c0",
  23: "#808080",
  64: "#000000",
};

export interface ExcelColor {
  argb?: string;
  theme?: number;
  tint?: number;
  indexed?: number;
}

export function excelColorToCss(color: ExcelColor | undefined, fallback = "#000000"): string {
  if (!color) {
    return fallback;
  }
  if (color.argb) {
    return argbToCss(color.argb);
  }
  if (color.theme !== undefined) {
    return THEME[color.theme] ?? fallback;
  }
  if (color.indexed !== undefined) {
    return INDEXED[color.indexed] ?? fallback;
  }
  return fallback;
}

export function argbToCss(argb: string): string {
  const hex = argb.replace(/^#/, "").toLowerCase();
  if (hex.length > 6) {
    return `#${hex.slice(-6)}`;
  }
  return `#${hex.padStart(6, "0")}`;
}
