import type ExcelJS from "exceljs";
import { optionsFromRect } from "../../model/SheetImage";
import type { Sheet } from "../../model/Sheet";
import { HEADER_HEIGHT, INDEX_WIDTH } from "../../shared/constants";

const EMU_PER_CM = 360000;

export function emuToPx(emu: number): number {
  return Math.round((28.3527 * (emu / EMU_PER_CM) / 72) * 96);
}

export function readExcelImages(excel: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, sheet: Sheet): void {
  const media = worksheet.getImages();
  media.forEach((item, index) => {
    const image = excel.getImage(Number(item.imageId));
    const url = imageToDataUrl(image);
    if (!url) {
      return;
    }
    const box = excelRangeToRect(sheet, item.range);
    sheet.images.add({
      id: index,
      url,
      options: optionsFromRect(box.width, box.height, box),
    });
  });
}

export function writeExcelImages(excel: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, sheet: Sheet): void {
  for (const image of sheet.images.list()) {
    const ext = extensionFromUrl(image.url);
    const imageId = excel.addImage({
      base64: image.url,
      extension: ext,
    });
    const rect = {
      x: image.options.left - ((image.options.width || 0) * (image.options.scaleX ?? 1)) / 2,
      y: image.options.top - ((image.options.height || 0) * (image.options.scaleY ?? 1)) / 2,
      width: Math.max(1, (image.options.width || 0) * (image.options.scaleX ?? 1)),
      height: Math.max(1, (image.options.height || 0) * (image.options.scaleY ?? 1)),
    };
    const contentX = Math.max(0, rect.x - INDEX_WIDTH);
    const contentY = Math.max(0, rect.y - HEADER_HEIGHT);
    const col = offsetToIndex((ci) => sheet.cols.getWidth(ci), sheet.cols.len, contentX);
    const row = offsetToIndex((ri) => sheet.rows.getHeight(ri), sheet.rows.len, contentY);
    worksheet.addImage(imageId, {
      tl: { col: col.index + col.frac, row: row.index + row.frac },
      ext: { width: rect.width, height: rect.height },
      editAs: "absolute",
    });
  }
}

function excelRangeToRect(
  sheet: Sheet,
  range: ExcelJS.ImageRange & Partial<ExcelJS.ImagePosition>,
): { x: number; y: number; width: number; height: number } {
  const tl = anchorToContent(sheet, range.tl);
  let width = 200;
  let height = 200;
  if (range.ext?.width && range.ext?.height) {
    width = range.ext.width;
    height = range.ext.height;
  } else if (range.br) {
    const br = anchorToContent(sheet, range.br);
    width = Math.max(1, br.x - tl.x);
    height = Math.max(1, br.y - tl.y);
  }
  return {
    x: INDEX_WIDTH + tl.x,
    y: HEADER_HEIGHT + tl.y,
    width,
    height,
  };
}

function anchorToContent(
  sheet: Sheet,
  anchor: ExcelJS.IAnchor | { col: number; row: number } | undefined,
): { x: number; y: number } {
  if (!anchor) {
    return { x: 0, y: 0 };
  }
  if ("nativeCol" in anchor && typeof anchor.nativeCol === "number") {
    return {
      x: sheet.colLeft(anchor.nativeCol) + emuToPx(anchor.nativeColOff || 0),
      y: sheet.rowTop(anchor.nativeRow) + emuToPx(anchor.nativeRowOff || 0),
    };
  }
  const col = Number(anchor.col ?? 0);
  const row = Number(anchor.row ?? 0);
  const ci = Math.max(0, Math.floor(col));
  const ri = Math.max(0, Math.floor(row));
  return {
    x: sheet.colLeft(ci) + (col - ci) * sheet.cols.getWidth(ci),
    y: sheet.rowTop(ri) + (row - ri) * sheet.rows.getHeight(ri),
  };
}

function offsetToIndex(sizeAt: (index: number) => number, len: number, offset: number): { index: number; frac: number } {
  let acc = 0;
  for (let i = 0; i < len; i += 1) {
    const size = sizeAt(i);
    if (acc + size > offset) {
      return { index: i, frac: size ? (offset - acc) / size : 0 };
    }
    acc += size;
  }
  return { index: Math.max(0, len - 1), frac: 1 };
}

function imageToDataUrl(image: ExcelJS.Image | undefined): string | undefined {
  if (!image) {
    return undefined;
  }
  const mime = image.extension === "jpeg" ? "image/jpeg" : image.extension === "gif" ? "image/gif" : "image/png";
  if (image.base64) {
    const raw = image.base64.includes(",") ? image.base64.slice(image.base64.indexOf(",") + 1) : image.base64;
    return `data:${mime};base64,${raw}`;
  }
  if (image.buffer) {
    return `data:${mime};base64,${bufferToBase64(image.buffer)}`;
  }
  return undefined;
}

function bufferToBase64(data: Buffer | ArrayBuffer | Uint8Array): string {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    return data.toString("base64");
  }
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function extensionFromUrl(url: string): "png" | "jpeg" | "gif" {
  if (/image\/jpe?g/i.test(url)) {
    return "jpeg";
  }
  if (/image\/gif/i.test(url)) {
    return "gif";
  }
  return "png";
}
