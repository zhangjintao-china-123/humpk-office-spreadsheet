import type { AutoFilterJson } from "./AutoFilter";
import type { Cell } from "./Cell";
import type { CellStyle } from "./CellStyle";
import type { SheetImage } from "./SheetImage";

export interface SheetJson {
  name: string;
  styles?: CellStyle[];
  merges?: string[];
  cols?: Record<string, unknown>;
  rows?: Record<string, unknown>;
  uploadimages?: SheetImage[];
  autofilter?: AutoFilterJson;
  freeze?: string;
}

export type WorkbookJson = SheetJson[];

export interface CellJson extends Cell {}
