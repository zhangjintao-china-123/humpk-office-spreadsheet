export type Align = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";
export type BorderSide = [string, string];

export interface FontStyle {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
}

export interface BorderStyle {
  top?: BorderSide;
  right?: BorderSide;
  bottom?: BorderSide;
  left?: BorderSide;
}

export interface CellStyle {
  align?: Align;
  valign?: VAlign;
  bgcolor?: string;
  color?: string;
  textwrap?: boolean;
  strike?: boolean;
  underline?: boolean;
  font?: FontStyle;
  border?: BorderStyle;
}

export const DEFAULT_STYLE: Required<Omit<CellStyle, "border">> & { border?: BorderStyle } = {
  bgcolor: "#ffffff",
  align: "left",
  valign: "middle",
  textwrap: false,
  strike: false,
  underline: false,
  color: "#0a0a0a",
  font: { name: "Arial", size: 10, bold: false, italic: false },
};

export function mergeStyle(base: CellStyle, patch: CellStyle): CellStyle {
  return {
    ...base,
    ...patch,
    font: { ...base.font, ...patch.font },
    border: patch.border === undefined
      ? cloneBorder(base.border)
      : { ...cloneBorder(base.border), ...cloneBorder(patch.border) },
  };
}

export function cloneStyle(style: CellStyle): CellStyle {
  return {
    ...style,
    font: style.font ? { ...style.font } : undefined,
    border: cloneBorder(style.border),
  };
}

export function cloneBorder(border: BorderStyle | undefined): BorderStyle | undefined {
  if (!border) {
    return undefined;
  }
  return {
    top: border.top ? [border.top[0], border.top[1]] : undefined,
    right: border.right ? [border.right[0], border.right[1]] : undefined,
    bottom: border.bottom ? [border.bottom[0], border.bottom[1]] : undefined,
    left: border.left ? [border.left[0], border.left[1]] : undefined,
  };
}

export function stylesEqual(a: CellStyle, b: CellStyle): boolean {
  return JSON.stringify(normalizeStyle(a)) === JSON.stringify(normalizeStyle(b));
}

export function normalizeStyle(style: CellStyle): CellStyle {
  const font = style.font;
  return {
    align: style.align,
    valign: style.valign,
    bgcolor: style.bgcolor,
    color: style.color,
    textwrap: style.textwrap,
    strike: style.strike,
    underline: style.underline,
    font: font
      ? {
          name: font.name,
          size: font.size,
          bold: font.bold,
          italic: font.italic,
        }
      : undefined,
    border: cloneBorder(style.border),
  };
}

export function resolveStyle(style: CellStyle | undefined): CellStyle {
  if (!style) {
    return cloneStyle(DEFAULT_STYLE);
  }
  return mergeStyle(DEFAULT_STYLE, style);
}

export function styleFontCss(style: CellStyle): string {
  const font = { ...DEFAULT_STYLE.font, ...style.font };
  const size = (font.size ?? 10) * (96 / 72);
  const italic = font.italic ? "italic" : "normal";
  const weight = font.bold ? "bold" : "normal";
  return `${italic} ${weight} ${size}px ${font.name ?? "Arial"}`;
}
