const THEME = ["#ffffff", "#000100", "#e7e5e6", "#445569", "#5b9cd6", "#ed7d31", "#a5a5a5", "#ffc001", "#4371c6", "#71ae47"];

/** Excel 默认 indexed 调色板 0–65（无自定义 colors 时） */
const INDEXED = [
  "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff",
  "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff",
  "#800000", "#008000", "#000080", "#808000", "#800080", "#008080", "#c0c0c0", "#808080",
  "#9999ff", "#993366", "#ffffcc", "#ccffff", "#660066", "#ff8080", "#0066cc", "#cccccc",
  "#000080", "#ff00ff", "#ffff00", "#00ffff", "#800080", "#800000", "#008080", "#0000ff",
  "#00ccff", "#ccffff", "#ccffcc", "#ffff99", "#99ccff", "#ff99cc", "#cc99ff", "#ffcc99",
  "#3366ff", "#33cccc", "#99cc00", "#ffcc00", "#ff9900", "#ff6600", "#666699", "#969696",
  "#003366", "#339966", "#003300", "#333300", "#993300", "#993366", "#333399", "#333333",
  "#000000", "#ffffff",
];

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
  let css = fallback;
  if (color.argb) {
    css = argbToCss(color.argb);
  } else if (color.theme !== undefined) {
    css = THEME[color.theme] ?? fallback;
  } else if (color.indexed !== undefined) {
    css = INDEXED[color.indexed] ?? fallback;
  } else {
    return fallback;
  }
  if (typeof color.tint === "number" && Number.isFinite(color.tint) && color.tint !== 0) {
    return applyTint(css, color.tint);
  }
  return css;
}

export function argbToCss(argb: string): string {
  const hex = argb.replace(/^#/, "").toLowerCase();
  if (hex.length > 6) {
    return `#${hex.slice(-6)}`;
  }
  return `#${hex.padStart(6, "0")}`;
}

function applyTint(css: string, tint: number): string {
  const rgb = cssToRgb(css);
  if (!rgb) return css;
  const next = rgb.map((channel) => {
    if (tint < 0) return Math.round(channel * (1 + tint));
    return Math.round(channel * (1 - tint) + 255 * tint);
  });
  return `#${next.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("")}`;
}

function cssToRgb(css: string): [number, number, number] | null {
  const hex = css.replace(/^#/, "");
  if (hex.length !== 6) return null;
  const n = Number.parseInt(hex, 16);
  if (!Number.isFinite(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
