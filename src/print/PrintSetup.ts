export type PaperName = "A3" | "A4" | "A5" | "B4" | "B5";
export type Orientation = "portrait" | "landscape";

export const PAPER_NAMES: PaperName[] = ["A3", "A4", "A5", "B4", "B5"];
export const PAPER_INCHES: Record<PaperName, [number, number]> = {
  A3: [11.69, 16.54],
  A4: [8.27, 11.69],
  A5: [5.83, 8.27],
  B4: [9.84, 13.9],
  B5: [6.93, 9.84],
};
export const PRINT_SCALES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
export const MAX_PRINT_PAGES = 200;

export function inchesToPx(inches: number): number {
  return Math.round(inches * 96);
}

export class PrintSetup {
  name: PaperName = "A4";
  orientation: Orientation = "landscape";
  marginX = 30;
  marginY = 30;
  scale = 1;

  get cssWidth(): number {
    const [width, height] = PAPER_INCHES[this.name];
    const pw = inchesToPx(width);
    const ph = inchesToPx(height);
    return this.orientation === "landscape" ? ph : pw;
  }

  get cssHeight(): number {
    const [width, height] = PAPER_INCHES[this.name];
    const pw = inchesToPx(width);
    const ph = inchesToPx(height);
    return this.orientation === "landscape" ? pw : ph;
  }

  get contentWidth(): number {
    return Math.max(1, this.cssWidth - this.marginX * 2);
  }

  get contentHeight(): number {
    return Math.max(1, this.cssHeight - this.marginY * 2);
  }

  get cellSpaceWidth(): number {
    return this.contentWidth / this.scale;
  }

  get cellSpaceHeight(): number {
    return this.contentHeight / this.scale;
  }
}
