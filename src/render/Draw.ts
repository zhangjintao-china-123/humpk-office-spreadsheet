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
}
