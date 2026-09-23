import type { AutoFilterJson } from "./AutoFilter";
import type { Cell } from "./Cell";
import type { CellStyle } from "./CellStyle";
import type { SheetImage } from "./SheetImage";

export interface SheetJson {
  name: string;
  table?: string;
  filters?: Record<string, string | number>;
  styles?: CellStyle[];
  merges?: string[];
  cols?: Record<string, unknown>;
  rows?: Record<string, unknown>;
  uploadimages?: SheetImage[];
  autofilter?: AutoFilterJson;
  freeze?: string;
  checkmarks?: string[];
  editables?: string[];
  cellControls?: Array<{ ref: string; kind: string; options?: string[] }>;
  cellMarks?: Array<{ ref: string; priority?: number; shape?: string; verdict?: string }>;
}

export type WorkbookJson = SheetJson[];

export interface CellJson extends Cell {}
