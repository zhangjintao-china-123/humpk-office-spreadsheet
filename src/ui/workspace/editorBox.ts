import { EDITOR_CHROME } from "../../shared/constants";

export type EditorBoxInput = {
  cellWidth: number;
  cellHeight: number;
  textWidth: number;
  available: number;
  wrap: boolean;
  lineCount: number;
  lineHeight: number;
  chrome?: number;
};

export function editorBoxSize(input: EditorBoxInput): { width: number; height: number } {
  const chrome = input.chrome ?? EDITOR_CHROME;
  const minWidth = Math.max(1, input.cellWidth);
  const width = input.wrap
    ? minWidth
    : Math.min(Math.max(minWidth, input.textWidth + chrome), Math.max(minWidth, input.available));
  const height = Math.max(input.cellHeight, 20, Math.ceil(Math.max(1, input.lineCount) * input.lineHeight) + 8);
  return { width, height };
}
