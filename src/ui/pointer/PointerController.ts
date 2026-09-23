import { imageRect, optionsFromRect, resizeRect, type ImageHandle, type SheetImageOptions } from "../../model/SheetImage";
import type { Hit } from "../../selection/HitTester";
import { FORMULA_REF_CURSORS, FormulaRefHitTester, type FormulaRefHit } from "../../selection/FormulaRefHitTester";
import { IMAGE_CURSORS, ImageHitTester, type ImageHit } from "../../selection/ImageHitTester";
import { hitFillHandle, hitFillTarget, resolveFillDest, type FillAxis } from "../../selection/FillHandle";
import type { CellRange } from "../../model/CellRange";
import { MIN_IMAGE_SIZE } from "../../shared/constants";
import { resizeFormulaRange } from "../../formula/formulaEdit";
import type { Workspace } from "../workspace/Workspace";

export class PointerController {
  private drag: { kind: Hit["kind"]; sri: number; sci: number; index?: number; start: number; frozen?: boolean } | null = null;
  private formulaDrag: { index: number; handle: ImageHandle } | null = null;
  private fillDrag: { source: CellRange; dest?: CellRange; axis?: FillAxis } | null = null;
  private readonly formulaHit = new FormulaRefHitTester();
  private imageDrag: {
    id: number;
    mode: "move" | "resize";
    handle?: ImageHandle;
    startX: number;
    startY: number;
    start: SheetImageOptions;
  } | null = null;
  private readonly imageHit = new ImageHitTester();

  constructor(private readonly workspace: Workspace) {}

  attach(el: HTMLElement): void {
    el.addEventListener("mousedown", this.onDown);
    el.addEventListener("mousemove", this.onMove);
    el.addEventListener("mouseleave", this.onLeave);
    el.addEventListener("dblclick", this.onDbl);
    el.addEventListener("contextmenu", this.onMenu);
  }

  private onDown = (event: MouseEvent): void => {
    if (event.button !== 0) {
      return;
    }
    const ws = this.workspace;
    if (ws.isFormulaEditing()) {
      event.preventDefault();
      const formulaHit = this.formulaHitOf(event);
      if (formulaHit) {
        this.formulaDrag = formulaHit;
        window.addEventListener("mousemove", this.onDrag);
        window.addEventListener("mouseup", this.onUp);
        return;
      }
      const hit = this.hitOf(event);
      if (hit?.kind === "cell") {
        this.drag = { kind: "cell", sri: hit.ri, sci: hit.ci, start: 0 };
        ws.applyFormulaPoint(hit.ri, hit.ci, hit.ri, hit.ci);
        window.addEventListener("mousemove", this.onDrag);
        window.addEventListener("mouseup", this.onUp);
      }
      return;
    }
    ws.commitFormulaBar();
    ws.focusGrid();
    ws.hideNoteTip();
    const imageHit = this.imageHitOf(event);
    if (imageHit) {
      if (ws.editing) {
        ws.commitEdit("none");
      }
      ws.selectImage(imageHit.id);
      const image = ws.sheet().images.get(imageHit.id);
      if (!image) {
        return;
      }
      this.imageDrag = {
        id: imageHit.id,
        mode: imageHit.kind === "image-resize" ? "resize" : "move",
        handle: imageHit.handle,
        startX: event.clientX,
        startY: event.clientY,
        start: { ...image.options },
      };
      event.preventDefault();
      window.addEventListener("mousemove", this.onDrag);
      window.addEventListener("mouseup", this.onUp);
      ws.render();
      ws.emitUi();
      return;
    }
    if (ws.selectedImageId !== undefined) {
      ws.selectImage(undefined);
    }
    const hit = this.hitOf(event);
    if (hit?.kind === "filter-button") {
      if (ws.editing && !ws.isFormulaEditing()) {
        ws.commitEdit("none");
      }
      event.preventDefault();
      ws.openFilterMenu(hit.ci);
      ws.render();
      ws.emitUi();
      return;
    }
    if (!ws.isFormulaEditing() && this.fillHandleHit(event)) {
      if (ws.editing) {
        ws.commitEdit("none");
      }
      this.fillDrag = { source: ws.selection.range.clone() };
      event.preventDefault();
      window.addEventListener("mousemove", this.onDrag);
      window.addEventListener("mouseup", this.onUp);
      ws.render();
      ws.emitUi();
      ws.focusGrid();
      return;
    }
    if (!hit) {
      return;
    }
    if (ws.editing) {
      if (ws.isFormulaEditing()) {
        return;
      }
      ws.commitEdit("none");
    }
    const sheet = ws.sheet();
    let additiveFrozen = false;
    if (hit.kind === "corner") {
      ws.selection.selectAll(sheet.rows.len, sheet.cols.len);
    } else if (hit.kind === "row-header") {
      if (event.shiftKey) {
        ws.selection.selectRows(ws.selection.ri, hit.ri, sheet.cols.len);
      } else if (isAdditive(event)) {
        additiveFrozen = ws.selection.addOrToggleRow(hit.ri, sheet.cols.len) === "removed";
      } else {
        ws.selection.selectRow(hit.ri, sheet.cols.len);
      }
    } else if (hit.kind === "col-header") {
      if (event.shiftKey) {
        ws.selection.selectCols(ws.selection.ci, hit.ci, sheet.rows.len);
      } else if (isAdditive(event)) {
        additiveFrozen = ws.selection.addOrToggleCol(hit.ci, sheet.rows.len) === "removed";
      } else {
        ws.selection.selectCol(hit.ci, sheet.rows.len);
      }
    } else if (hit.kind === "cell") {
      if (event.shiftKey) {
        ws.selection.setRange(ws.selection.ri, ws.selection.ci, hit.ri, hit.ci, sheet);
      } else if (isAdditive(event)) {
        additiveFrozen = ws.selection.addOrToggleCell(hit.ri, hit.ci, sheet) === "removed";
      } else {
        ws.selection.set(hit.ri, hit.ci, sheet);
      }
      const controlHit = ws.controlHitAt(event.clientX, event.clientY);
      if (controlHit === "switch") {
        event.preventDefault();
        ws.toggleSwitchCell();
        ws.render();
        ws.emitUi();
        ws.focusGrid();
        return;
      }
      if (controlHit === "dropdown") {
        event.preventDefault();
        ws.openCellDropdown();
        ws.render();
        ws.emitUi();
        return;
      }
    } else if (hit.kind === "col-resize" || hit.kind === "row-resize") {
      ws.beginResize(hit.kind === "col-resize" ? "column" : "row", hit.index ?? 0);
      this.drag = {
        kind: hit.kind,
        sri: hit.ri,
        sci: hit.ci,
        index: hit.index,
        start: hit.kind === "col-resize" ? event.clientX : event.clientY,
      };
      event.preventDefault();
      window.addEventListener("mousemove", this.onDrag);
      window.addEventListener("mouseup", this.onUp);
      ws.render();
      ws.emitUi();
      return;
    }
    this.drag = {
      kind: hit.kind,
      sri: hit.kind === "row-header" ? ws.selection.ri : hit.ri,
      sci: hit.kind === "col-header" ? ws.selection.ci : hit.ci,
      start: 0,
      frozen: additiveFrozen,
    };
    event.preventDefault();
    window.addEventListener("mousemove", this.onDrag);
    window.addEventListener("mouseup", this.onUp);
    ws.render();
    ws.emitUi();
    ws.focusGrid();
  };

  private onDrag = (event: MouseEvent): void => {
    const imageDrag = this.imageDrag;
    if (imageDrag) {
      this.previewImage(event, imageDrag);
      return;
    }
    const fillDrag = this.fillDrag;
    if (fillDrag) {
      this.previewFill(event, fillDrag);
      return;
    }
    const formulaDrag = this.formulaDrag;
    if (formulaDrag) {
      const hit = this.hitOf(event);
      if (hit?.kind === "cell") {
        const refs = this.workspace.formulaPaintRefs();
        const ref = refs[formulaDrag.index];
        if (ref) {
          this.workspace.rewriteFormulaSpan(
            formulaDrag.index,
            resizeFormulaRange(ref.range, formulaDrag.handle, hit.ri, hit.ci),
          );
        }
      }
      return;
    }
    const drag = this.drag;
    if (!drag || drag.frozen) {
      return;
    }
    const ws = this.workspace;
    if (drag.kind === "col-resize" && drag.index !== undefined) {
      const width = ws.sheet().cols.getWidth(drag.index) + (event.clientX - drag.start);
      drag.start = event.clientX;
      ws.sheet().cols.setWidth(drag.index, Math.max(24, width));
      ws.syncPreview();
      return;
    }
    if (drag.kind === "row-resize" && drag.index !== undefined) {
      const height = ws.sheet().rows.getHeight(drag.index) + (event.clientY - drag.start);
      drag.start = event.clientY;
      ws.sheet().rows.setHeight(drag.index, Math.max(16, height));
      ws.syncPreview();
      return;
    }
    const hit = this.hitOf(event);
    if (!hit) {
      return;
    }
    const sheet = ws.sheet();
    if (drag.kind === "row-header") {
      const ri = rowIndexOf(hit);
      if (ri !== undefined) {
        ws.selection.selectRows(drag.sri, ri, sheet.cols.len);
        ws.render();
        ws.emitUi();
      }
      return;
    }
    if (drag.kind === "col-header") {
      const ci = colIndexOf(hit);
      if (ci !== undefined) {
        ws.selection.selectCols(drag.sci, ci, sheet.rows.len);
        ws.render();
        ws.emitUi();
      }
      return;
    }
    if (drag.kind === "cell" && hit.kind === "cell") {
      if (ws.isFormulaEditing()) {
        ws.applyFormulaPoint(drag.sri, drag.sci, hit.ri, hit.ci);
        return;
      }
      ws.selection.setRange(drag.sri, drag.sci, hit.ri, hit.ci, ws.sheet());
      ws.render();
      ws.emitUi();
    }
  };

  private onUp = (): void => {
    const imageDrag = this.imageDrag;
    this.imageDrag = null;
    this.formulaDrag = null;
    const fillDrag = this.fillDrag;
    this.fillDrag = null;
    const drag = this.drag;
    this.drag = null;
    window.removeEventListener("mousemove", this.onDrag);
    window.removeEventListener("mouseup", this.onUp);
    if (imageDrag) {
      this.workspace.finishImageDrag(imageDrag.id, imageDrag.start);
      return;
    }
    if (fillDrag) {
      this.workspace.fillPreview = undefined;
      if (fillDrag.dest && fillDrag.axis) {
        this.workspace.applyFill(fillDrag.source, fillDrag.dest, fillDrag.axis);
        return;
      }
      this.workspace.render();
      this.workspace.emitUi();
      return;
    }
    if (drag?.kind === "col-resize" && drag.index !== undefined) {
      this.workspace.finishResize("column", drag.index);
    }
    if (drag?.kind === "row-resize" && drag.index !== undefined) {
      this.workspace.finishResize("row", drag.index);
    }
    if (
      drag
      && !this.workspace.isFormulaEditing()
      && (drag.kind === "cell" || drag.kind === "row-header" || drag.kind === "col-header" || drag.kind === "corner")
    ) {
      this.workspace.applyPaintFormat();
    }
  };

  private onMove = (event: MouseEvent): void => {
    if (this.imageDrag || this.drag || this.formulaDrag || this.fillDrag) {
      return;
    }
    if (this.workspace.isFormulaEditing()) {
      const formulaHit = this.formulaHitOf(event);
      if (formulaHit) {
        this.workspace.scroll.style.cursor = FORMULA_REF_CURSORS[formulaHit.handle];
        return;
      }
    }
    const imageHit = this.imageHitOf(event);
    const el = this.workspace.scroll;
    if (imageHit?.kind === "image-resize" && imageHit.handle) {
      el.style.cursor = IMAGE_CURSORS[imageHit.handle];
      return;
    }
    if (imageHit?.kind === "image") {
      el.style.cursor = "move";
      return;
    }
    if (!this.workspace.isFormulaEditing() && this.fillHandleHit(event)) {
      el.style.cursor = "crosshair";
      return;
    }
    const hit = this.hitOf(event);
    if (hit?.kind === "col-resize") {
      el.style.cursor = "col-resize";
    } else if (hit?.kind === "row-resize") {
      el.style.cursor = "row-resize";
    } else if (hit?.kind === "cell") {
      el.style.cursor = "cell";
      this.workspace.showNoteTip(hit.ri, hit.ci, event.clientX, event.clientY);
      return;
    } else if (hit?.kind === "filter-button") {
      el.style.cursor = "pointer";
    } else {
      el.style.cursor = "default";
    }
    this.workspace.hideNoteTip();
  };

  private onLeave = (): void => {
    this.workspace.hideNoteTip();
  };

  private onDbl = (event: MouseEvent): void => {
    if (this.imageHitOf(event)) {
      return;
    }
    const hit = this.hitOf(event);
    if (hit?.kind === "cell") {
      if (this.workspace.isFormulaEditing()) {
        this.workspace.applyFormulaPoint(hit.ri, hit.ci, hit.ri, hit.ci);
        return;
      }
      this.workspace.enterEdit();
    }
  };

  private onMenu = (event: MouseEvent): void => {
    event.preventDefault();
    if (event.ctrlKey) {
      return;
    }
    const imageHit = this.imageHitOf(event);
    if (imageHit) {
      this.workspace.selectImage(imageHit.id);
      this.workspace.render();
      this.workspace.showContextMenu(event.clientX, event.clientY);
      return;
    }
    const hit = this.hitOf(event);
    if (hit?.kind === "cell") {
      this.workspace.selectImage(undefined);
      if (!this.workspace.selection.includesCell(hit.ri, hit.ci)) {
        this.workspace.selection.set(hit.ri, hit.ci, this.workspace.sheet());
        this.workspace.render();
      }
    }
    this.workspace.showContextMenu(event.clientX, event.clientY);
  };

  private previewImage(
    event: MouseEvent,
    drag: { id: number; mode: "move" | "resize"; handle?: ImageHandle; startX: number; startY: number; start: SheetImageOptions },
  ): void {
    const image = this.workspace.sheet().images.get(drag.id);
    if (!image) {
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const startImage = { id: drag.id, url: image.url, options: drag.start };
    const startRect = imageRect(startImage);
    if (drag.mode === "move") {
      this.workspace.sheet().images.setOptions(drag.id, {
        ...drag.start,
        left: drag.start.left + dx,
        top: drag.start.top + dy,
      });
    } else if (drag.handle) {
      const next = resizeRect(startRect, drag.handle, dx, dy, MIN_IMAGE_SIZE);
      this.workspace.sheet().images.setOptions(
        drag.id,
        optionsFromRect(drag.start.width, drag.start.height, next),
      );
    }
    this.workspace.render();
  }

  private previewFill(event: MouseEvent, drag: { source: CellRange; dest?: CellRange; axis?: FillAxis }): void {
    const ws = this.workspace;
    const rect = ws.scroll.getBoundingClientRect();
    const target = hitFillTarget(
      ws.sheet(),
      event.clientX - rect.left,
      event.clientY - rect.top,
      ws.scrollX(),
      ws.scrollY(),
    );
    if (!target) {
      return;
    }
    const resolved = resolveFillDest(drag.source, target.ri, target.ci);
    drag.dest = resolved?.dest;
    drag.axis = resolved?.axis;
    ws.fillPreview = resolved?.dest.clone();
    ws.scroll.style.cursor = "crosshair";
    ws.render();
  }

  private fillHandleHit(event: MouseEvent): boolean {
    const ws = this.workspace;
    if (ws.selectedImageId !== undefined) {
      return false;
    }
    const rect = ws.scroll.getBoundingClientRect();
    return hitFillHandle(
      ws.sheet(),
      ws.selection.range,
      event.clientX - rect.left,
      event.clientY - rect.top,
      ws.scrollX(),
      ws.scrollY(),
    );
  }

  private hitOf(event: MouseEvent) {
    const rect = this.workspace.scroll.getBoundingClientRect();
    return this.workspace.hit.hit(
      this.workspace.sheet(),
      event.clientX - rect.left,
      event.clientY - rect.top,
      this.workspace.scrollX(),
      this.workspace.scrollY(),
    );
  }

  private formulaHitOf(event: MouseEvent): FormulaRefHit | undefined {
    const rect = this.workspace.scroll.getBoundingClientRect();
    return this.formulaHit.hit(
      this.workspace.sheet(),
      this.workspace.formulaPaintRefs(),
      event.clientX - rect.left,
      event.clientY - rect.top,
      this.workspace.scrollX(),
      this.workspace.scrollY(),
    );
  }

  private imageHitOf(event: MouseEvent): ImageHit | undefined {
    const rect = this.workspace.scroll.getBoundingClientRect();
    return this.imageHit.hit(
      this.workspace.sheet(),
      event.clientX - rect.left,
      event.clientY - rect.top,
      this.workspace.scrollX(),
      this.workspace.scrollY(),
      this.workspace.selectedImageId,
    );
  }
}

function isAdditive(event: MouseEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey;
}

function rowIndexOf(hit: Hit): number | undefined {
  if (hit.kind === "row-header" || hit.kind === "cell") {
    return hit.ri;
  }
  if (hit.kind === "row-resize") {
    return hit.index ?? hit.ri;
  }
  return undefined;
}

function colIndexOf(hit: Hit): number | undefined {
  if (hit.kind === "col-header" || hit.kind === "cell") {
    return hit.ci;
  }
  if (hit.kind === "col-resize") {
    return hit.index ?? hit.ci;
  }
  return undefined;
}
