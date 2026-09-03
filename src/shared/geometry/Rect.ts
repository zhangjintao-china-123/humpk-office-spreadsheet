export class Rect {
  constructor(
    public x = 0,
    public y = 0,
    public width = 0,
    public height = 0,
  ) {}

  get right(): number {
    return this.x + this.width;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  contains(x: number, y: number): boolean {
    return x >= this.x && y >= this.y && x <= this.right && y <= this.bottom;
  }

  clone(): Rect {
    return new Rect(this.x, this.y, this.width, this.height);
  }
}
