import type { CellMark, CellShapeMark, CellVerdictMark } from "../model/CellMarks";
import { cellMarkBadgeLayout, PRIORITY_COLORS, SHAPE_MARK_COLOR, VERDICT_COLORS } from "../model/CellMarks";

export class Draw {
  readonly ctx: CanvasRenderingContext2D;
  cssWidth = 0;
  cssHeight = 0;

  constructor(readonly el: HTMLCanvasElement) {
    const ctx = el.getContext("2d");
    if (!ctx) {
      throw new Error("2d context unavailable");
    }
    this.ctx = ctx;
  }

  dpr(): number {
    return globalThis.devicePixelRatio || 1;
  }

  resize(cssWidth: number, cssHeight: number): void {
    const width = Math.max(1, cssWidth);
    const height = Math.max(1, cssHeight);
    this.cssWidth = width;
    this.cssHeight = height;
    const dpr = this.dpr();
    this.el.style.width = `${width}px`;
    this.el.style.height = `${height}px`;
    this.el.width = Math.max(1, Math.round(width * dpr));
    this.el.height = Math.max(1, Math.round(height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.el.width, this.el.height);
    this.ctx.restore();
  }

  save(): void {
    this.ctx.save();
  }

  restore(): void {
    this.ctx.restore();
  }

  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }

  scale(x: number, y: number): void {
    this.ctx.scale(x, y);
  }

  clipRect(x: number, y: number, width: number, height: number): void {
    this.ctx.beginPath();
    this.ctx.rect(x, y, width, height);
    this.ctx.clip();
  }

  fillRect(x: number, y: number, width: number, height: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
  }

  strokeRect(x: number, y: number, width: number, height: number, color: string, lineWidth = 1, dash?: readonly number[]): void {
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.setLineDash(dash ? [...dash] : []);
    this.ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    this.ctx.restore();
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 1): void {
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.setLineDash([]);
    this.ctx.moveTo(x1 + 0.5, y1 + 0.5);
    this.ctx.lineTo(x2 + 0.5, y2 + 0.5);
    this.ctx.stroke();
  }

  setFont(font: string): void {
    this.ctx.font = font;
  }

  measureText(text: string): number {
    return this.ctx.measureText(text).width;
  }

  fillText(text: string, x: number, y: number, color: string, align: CanvasTextAlign, baseline: CanvasTextBaseline): void {
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, x, y);
  }

  drawImage(image: CanvasImageSource, x: number, y: number, width: number, height: number): void {
    this.ctx.drawImage(image, x, y, width, height);
  }

  editBadge(x: number, y: number, width: number, height: number, color: string): void {
    const size = Math.min(13, Math.max(9, Math.min(width, height) * 0.38));
    const cx = x + width - size * 0.72;
    const cy = y + size * 0.72;
    this.ctx.save();
    this.ctx.fillStyle = "#ffffff";
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, size * 0.62, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = Math.max(1.4, size * 0.16);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(cx - size * 0.28, cy + size * 0.22);
    this.ctx.lineTo(cx - size * 0.18, cy + size * 0.32);
    this.ctx.lineTo(cx + size * 0.32, cy - size * 0.18);
    this.ctx.lineTo(cx + size * 0.18, cy - size * 0.32);
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(cx + size * 0.1, cy - size * 0.24);
    this.ctx.lineTo(cx + size * 0.24, cy - size * 0.1);
    this.ctx.stroke();
    this.ctx.restore();
  }

  cellDropdown(x: number, y: number, width: number, height: number): void {
    const sx = x + width - 12;
    const sy = y + height / 2 - 2;
    this.ctx.beginPath();
    this.ctx.moveTo(sx, sy);
    this.ctx.lineTo(sx + 8, sy);
    this.ctx.lineTo(sx + 4, sy + 5);
    this.ctx.closePath();
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    this.ctx.fill();
  }

  switchControl(x: number, y: number, width: number, height: number, on: boolean): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, width, height, height / 2);
    this.ctx.fillStyle = on ? "#1677ff" : "#d4d4d4";
    this.ctx.fill();
    const pad = 2;
    const radius = Math.max(3, (height - pad * 2) / 2);
    const cx = on ? x + width - pad - radius : x + pad + radius;
    const cy = y + height / 2;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fill();
    this.ctx.restore();
  }

  dropdown(x: number, y: number, width: number, height: number, filtered = false): void {
    const sx = x + width - 15;
    const sy = y + height - 13;
    this.ctx.beginPath();
    this.ctx.moveTo(sx, sy);
    this.ctx.lineTo(sx + 8, sy);
    this.ctx.lineTo(sx + 4, sy + 6);
    this.ctx.closePath();
    this.ctx.fillStyle = filtered ? "#217346" : "rgba(0, 0, 0, 0.45)";
    this.ctx.fill();
  }

  noteMarker(x: number, y: number, width: number, height: number, color: string): void {
    const size = Math.min(8, Math.max(5, Math.min(width, height) * 0.28));
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x + width - 1, y + 1);
    this.ctx.lineTo(x + width - 1, y + 1 + size);
    this.ctx.lineTo(x + width - 1 - size, y + 1);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  cellMarkBadges(x: number, y: number, width: number, height: number, mark: CellMark): void {
    const layout = cellMarkBadgeLayout(width, height, mark);
    if (!layout) {
      return;
    }
    const pad = 3;
    const gap = 2;
    let cx = x + width - pad - layout.rowWidth + layout.size / 2;
    const cy = y + height / 2;
    if (mark.verdict) {
      this.verdictBadge(cx, cy, layout.size, mark.verdict);
      cx += layout.size + gap;
    }
    if (mark.priority) {
      this.priorityBadge(cx, cy, layout.size, mark.priority, PRIORITY_COLORS[mark.priority]);
      cx += layout.size + gap;
    }
    if (mark.shape) {
      this.shapeBadge(cx, cy, layout.size, mark.shape, SHAPE_MARK_COLOR);
    }
  }

  private verdictBadge(cx: number, cy: number, size: number, verdict: CellVerdictMark): void {
    const r = size / 2;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fillStyle = VERDICT_COLORS[verdict];
    this.ctx.fill();
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = Math.max(1.2, size * 0.12);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    drawVerdictIcon(this.ctx, verdict, cx, cy, size);
    this.ctx.restore();
  }

  private priorityBadge(cx: number, cy: number, size: number, n: number, color: string): void {
    const r = size / 2;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.fillStyle = "#ffffff";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = `700 ${n >= 10 ? size * 0.48 : size * 0.58}px "Segoe UI", "PingFang SC", sans-serif`;
    this.ctx.fillText(String(n), cx, cy + 0.4);
    this.ctx.restore();
  }

  private shapeBadge(cx: number, cy: number, size: number, shape: CellShapeMark, color: string): void {
    const r = size / 2;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = Math.max(1.2, size * 0.1);
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    drawShapePath(this.ctx, shape, cx, cy, size * 0.34);
    this.ctx.stroke();
    this.ctx.restore();
  }
}

function drawVerdictIcon(
  ctx: CanvasRenderingContext2D,
  verdict: CellVerdictMark,
  cx: number,
  cy: number,
  size: number,
): void {
  const scale = size / 16;
  const ox = cx - 8 * scale;
  const oy = cy - 8 * scale;
  ctx.beginPath();
  if (verdict === "pass") {
    ctx.moveTo(ox + 3.6 * scale, oy + 8.2 * scale);
    ctx.lineTo(ox + 6.6 * scale, oy + 11.1 * scale);
    ctx.lineTo(ox + 12.4 * scale, oy + 4.8 * scale);
  } else {
    ctx.moveTo(ox + 4.4 * scale, oy + 4.4 * scale);
    ctx.lineTo(ox + 11.6 * scale, oy + 11.6 * scale);
    ctx.moveTo(ox + 11.6 * scale, oy + 4.4 * scale);
    ctx.lineTo(ox + 4.4 * scale, oy + 11.6 * scale);
  }
  ctx.stroke();
}

function drawShapePath(
  ctx: CanvasRenderingContext2D,
  shape: CellShapeMark,
  cx: number,
  cy: number,
  radius: number,
): void {
  if (shape === "star") {
    for (let i = 0; i < 5; i += 1) {
      const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const inner = outer + Math.PI / 5;
      const ox = cx + Math.cos(outer) * radius;
      const oy = cy + Math.sin(outer) * radius;
      const ix = cx + Math.cos(inner) * radius * 0.42;
      const iy = cy + Math.sin(inner) * radius * 0.42;
      if (i === 0) {
        ctx.moveTo(ox, oy);
      } else {
        ctx.lineTo(ox, oy);
      }
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    return;
  }
  if (shape === "flag") {
    const poleX = cx - radius * 0.55;
    ctx.moveTo(poleX, cy - radius);
    ctx.lineTo(poleX, cy + radius);
    ctx.moveTo(poleX, cy - radius * 0.92);
    ctx.lineTo(cx + radius * 0.7, cy - radius * 0.92);
    ctx.lineTo(cx + radius * 0.15, cy - radius * 0.18);
    ctx.lineTo(poleX, cy - radius * 0.18);
    return;
  }
  if (shape === "diamond") {
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius);
    ctx.lineTo(cx - radius, cy);
    ctx.closePath();
    return;
  }
  if (shape === "square") {
    const s = radius * 0.85;
    ctx.rect(cx - s, cy - s, s * 2, s * 2);
    return;
  }
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx + radius * 0.95, cy + radius * 0.8);
  ctx.lineTo(cx - radius * 0.95, cy + radius * 0.8);
  ctx.closePath();
}
