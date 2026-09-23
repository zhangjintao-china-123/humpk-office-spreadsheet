export type CellControlKind = "dropdown" | "switch";

export type CellControl =
  | { kind: "dropdown"; options: string[] }
  | { kind: "switch" };

export const SWITCH_WIDTH = 32;
export const SWITCH_HEIGHT = 16;
export const SWITCH_PAD = 6;
export const DROPDOWN_HIT = 16;

const SWITCH_ON = new Set(["TRUE", "YES", "ON", "1", "是", "开"]);

export function cloneCellControl(control: CellControl): CellControl {
  if (control.kind === "dropdown") {
    return { kind: "dropdown", options: [...control.options] };
  }
  return { kind: "switch" };
}

export function parseCellControl(kind: string | undefined, options?: string[]): CellControl | undefined {
  const value = (kind ?? "").trim().toLowerCase();
  if (value === "dropdown") {
    return { kind: "dropdown", options: uniqueOptions(options ?? []) };
  }
  if (value === "switch") {
    return { kind: "switch" };
  }
  return undefined;
}

export function parseDropdownOptions(text: string): string[] {
  return uniqueOptions(
    text
      .split(/[\n,，;；]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function formatDropdownOptions(options: string[]): string {
  return options.join("\n");
}

export function encodeControlOptions(options: string[]): string {
  return options.join("|");
}

export function decodeControlOptions(text: string): string[] {
  const raw = text.trim();
  if (!raw) {
    return [];
  }
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return uniqueOptions(parsed.map((item) => String(item).trim()).filter(Boolean));
      }
    } catch {
      // fall through to delimiter split
    }
  }
  return uniqueOptions(raw.split("|").map((item) => item.trim()).filter(Boolean));
}

export function isSwitchOn(text: string | undefined): boolean {
  return SWITCH_ON.has((text ?? "").trim().toUpperCase());
}

export function switchCellText(on: boolean): string {
  return on ? "TRUE" : "FALSE";
}

export function switchBox(width: number, height: number): { x: number; y: number; width: number; height: number } {
  const w = Math.min(SWITCH_WIDTH, Math.max(20, width - SWITCH_PAD * 2));
  const h = Math.min(SWITCH_HEIGHT, Math.max(12, height - 4));
  return {
    x: SWITCH_PAD,
    y: Math.max(0, (height - h) / 2),
    width: w,
    height: h,
  };
}

export function dropdownBox(width: number, height: number): { x: number; y: number; width: number; height: number } {
  const w = Math.min(DROPDOWN_HIT, Math.max(12, width));
  return { x: Math.max(0, width - w), y: 0, width: w, height };
}

export function hitSwitchControl(localX: number, localY: number, width: number, height: number): boolean {
  const box = switchBox(width, height);
  return localX >= box.x && localX <= box.x + box.width && localY >= box.y && localY <= box.y + box.height;
}

export function hitDropdownControl(localX: number, localY: number, width: number, height: number): boolean {
  const box = dropdownBox(width, height);
  return localX >= box.x && localX <= box.x + box.width && localY >= box.y && localY <= box.y + box.height;
}

function uniqueOptions(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}
