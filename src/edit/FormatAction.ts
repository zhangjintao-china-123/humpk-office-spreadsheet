import type { Align, VAlign } from "../model/CellStyle";

export type FormatAction =
  | { type: "bold" | "italic" | "underline" | "strike" | "clear" | "textwrap" }
  | { type: "align"; value: Align }
  | { type: "valign"; value: VAlign }
  | { type: "color" | "bgcolor" | "fontFamily" | "numFmt"; value: string }
  | { type: "fontSizePt"; value: number }
  | { type: "decimal"; value: 1 | -1 };

export type BorderMode = "all" | "outside" | "none" | "top" | "bottom" | "left" | "right" | "inside";
