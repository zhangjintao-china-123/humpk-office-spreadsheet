import type { BorderStyle } from "../model/CellStyle";
import type { Draw } from "./Draw";

/** 边画在格子交界上，共用边才能接上。 */
export function paintCellBorders(
  draw: Draw,
  x: number,
  y: number,
  width: number,
  height: number,
  border: BorderStyle | undefined,
): void {
  if (!border) {
    return;
  }
  const top = y;
  const bottom = y + height;
  const left = x;
  const right = x + width;
  if (border.top) {
    const weight = borderWidth(border.top[0]);
    draw.fillRect(left, top, right - left + weight, weight, border.top[1]);
  }
  if (border.right) {
    const weight = borderWidth(border.right[0]);
    draw.fillRect(right, top, weight, bottom - top + weight, border.right[1]);
  }
  if (border.bottom) {
    const weight = borderWidth(border.bottom[0]);
    draw.fillRect(left, bottom, right - left + weight, weight, border.bottom[1]);
  }
  if (border.left) {
    const weight = borderWidth(border.left[0]);
    draw.fillRect(left, top, weight, bottom - top + weight, border.left[1]);
  }
}

function borderWidth(style: string): number {
  if (style === "medium") {
    return 2;
  }
  if (style === "thick") {
    return 3;
  }
  return 1;
}
