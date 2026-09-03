import { CellRange } from "../model/CellRange";
import type { Cell } from "../model/Cell";
import type { BorderSide, BorderStyle } from "../model/CellStyle";
import type { Sheet } from "../model/Sheet";
import type { BorderMode } from "./FormatAction";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class ApplyBorderCommand implements EditCommand {
  private before = new Map<string, Cell | undefined>();

  constructor(
    private readonly host: EditHost,
    private readonly range: CellRange,
    private readonly mode: BorderMode,
    private readonly color: string,
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.before = sheet.snapshotCells(this.range);
    applyRangeBorders(sheet, this.range, this.mode, this.color);
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().restoreCells(this.before);
    this.host.afterChange();
  }
}

function applyRangeBorders(sheet: Sheet, range: CellRange, mode: BorderMode, color: string): void {
  const side: BorderSide = ["thin", color];
  const { sri, sci, eri, eci } = range;
  const multiple = range.multiple();

  if (mode === "none") {
    range.each((ri, ci) => sheet.setCellBorder(ri, ci, undefined));
    return;
  }
  if (!multiple && mode === "inside") {
    return;
  }
  if (mode === "outside" && !multiple) {
    sheet.setCellBorder(sri, sci, { top: side, bottom: side, left: side, right: side });
    return;
  }
  if (mode === "all" || mode === "inside" || mode === "outside") {
    const seen = new Set<string>();
    for (let ri = sri; ri <= eri; ri += 1) {
      for (let ci = sci; ci <= eci; ci += 1) {
        const merge = sheet.merges.getFirstIncludes(ri, ci);
        const ori = merge?.sri ?? ri;
        const oci = merge?.sci ?? ci;
        const key = `${ori},${oci}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        const meri = merge?.eri ?? ri;
        const meci = merge?.eci ?? ci;
        const border: BorderStyle = {};
        if (mode === "all") {
          border.top = side;
          border.bottom = side;
          border.left = side;
          border.right = side;
        } else if (mode === "inside") {
          if (meci < eci) {
            border.right = side;
          }
          if (meri < eri) {
            border.bottom = side;
          }
        } else {
          if (ori === sri) {
            border.top = side;
          }
          if (meri === eri) {
            border.bottom = side;
          }
          if (oci === sci) {
            border.left = side;
          }
          if (meci === eci) {
            border.right = side;
          }
        }
        if (hasSide(border)) {
          sheet.setCellBorder(ori, oci, border);
          if (merge?.multiple()) {
            if (border.bottom) {
              sheet.setCellBorder(meri, oci, { bottom: border.bottom });
            }
            if (border.right) {
              sheet.setCellBorder(ori, meci, { right: border.right });
            }
          }
        }
      }
    }
    return;
  }
  if (mode === "top" || mode === "bottom") {
    const edgeRi = mode === "top" ? sri : eri;
    const seen = new Set<number>();
    for (let ci = sci; ci <= eci; ci += 1) {
      const merge = sheet.merges.getFirstIncludes(edgeRi, ci);
      const oci = merge?.sci ?? ci;
      if (seen.has(oci)) {
        continue;
      }
      seen.add(oci);
      const patch: BorderStyle = mode === "top" ? { top: side } : { bottom: side };
      sheet.setCellBorder(merge?.sri ?? edgeRi, oci, patch);
      if (mode === "bottom" && merge) {
        sheet.setCellBorder(merge.eri, oci, patch);
      }
    }
    return;
  }
  const edgeCi = mode === "left" ? sci : eci;
  const seen = new Set<number>();
  for (let ri = sri; ri <= eri; ri += 1) {
    const merge = sheet.merges.getFirstIncludes(ri, edgeCi);
    const ori = merge?.sri ?? ri;
    if (seen.has(ori)) {
      continue;
    }
    seen.add(ori);
    const patch: BorderStyle = mode === "left" ? { left: side } : { right: side };
    sheet.setCellBorder(ori, merge?.sci ?? edgeCi, patch);
    if (mode === "right" && merge) {
      sheet.setCellBorder(ori, merge.eci, patch);
    }
  }
}

function hasSide(border: BorderStyle): boolean {
  return !!(border.top || border.right || border.bottom || border.left);
}
