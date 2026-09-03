import { imageRect, optionsFromRect, resizeRect, type ImageHandle, type SheetImageOptions } from "../../model/SheetImage";
import type { Hit } from "../../selection/HitTester";
import { IMAGE_CURSORS, ImageHitTester, type ImageHit } from "../../selection/ImageHitTester";
import { MIN_IMAGE_SIZE } from "../../shared/constants";
import type { Workspace } from "../workspace/Workspace";

export class PointerController {
  private drag: { kind: Hit["kind"]; sri: number; sci: number; index?: number; start: number } | null = null;
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
    el.addEventListener("dblclick", this.onDbl);
    el.addEventListener("contextmenu", this.onMenu);
  }

  private onDown = (event: MouseEvent): void => {
    if (event.button !== 0) {
      return;
    }
    const ws = this.workspace;
    ws.focusGrid();
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
    if (!hit) {
      return;
    }
    if (ws.editing) {
      ws.commitEdit("none");
    }
    if (hit.kind === "filter-button") {
      event.preventDefault();
      ws.openFilterMenu(hit.ci);
      ws.render();
      ws.emitUi();
      return;
    }
    const sheet = ws.sheet();
    if (hit.kind === "corner") {
      ws.selection.selectAll(sheet.rows.len, sheet.cols.len);
    } else if (hit.kind === "row-header") {
      ws.selection.selectRow(hit.ri, sheet.cols.len);
    } else if (hit.kind === "col-header") {
      ws.selection.selectCol(hit.ci, sheet.rows.len);
    } else if (hit.kind === "cell") {
      if (event.shiftKey) {
        ws.selection.setRange(ws.selection.ri, ws.selection.ci, hit.ri, hit.ci, sheet);
      } else {
        ws.selection.set(hit.ri, hit.ci, sheet);
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
    this.drag = { kind: hit.kind, sri: hit.ri, sci: hit.ci, start: 0 };
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
    const drag = this.drag;
    if (!drag) {
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
    if (drag.kind === "cell" && hit.kind === "cell") {
      ws.selection.setRange(drag.sri, drag.sci, hit.ri, hit.ci, ws.sheet());
      ws.render();
      ws.emitUi();
    }
  };

  private onUp = (): void => {
    const imageDrag = this.imageDrag;
    this.imageDrag = null;
    const drag = this.drag;
    this.drag = null;
    window.removeEventListener("mousemove", this.onDrag);
    window.removeEventListener("mouseup", this.onUp);
    if (imageDrag) {
      this.workspace.finishImageDrag(imageDrag.id, imageDrag.start);
      return;
    }
    if (drag?.kind === "col-resize" && drag.index !== undefined) {
      this.workspace.finishResize("column", drag.index);
    }
    if (drag?.kind === "row-resize" && drag.index !== undefined) {
      this.workspace.finishResize("row", drag.index);
    }
    if (drag && (drag.kind === "cell" || drag.kind === "row-header" || drag.kind === "col-header" || drag.kind === "corner")) {
      this.workspace.applyPaintFormat();
    }
  };

  private onMove = (event: MouseEvent): void => {
    if (this.imageDrag || this.drag) {
      return;
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
    const hit = this.hitOf(event);
    if (hit?.kind === "col-resize") {
      el.style.cursor = "col-resize";
    } else if (hit?.kind === "row-resize") {
      el.style.cursor = "row-resize";
    } else if (hit?.kind === "cell") {
      el.style.cursor = "cell";
    } else if (hit?.kind === "filter-button") {
      el.style.cursor = "pointer";
    } else {
      el.style.cursor = "default";
    }
  };

  private onDbl = (event: MouseEvent): void => {
    if (this.imageHitOf(event)) {
      return;
    }
    const hit = this.hitOf(event);
    if (hit?.kind === "cell") {
      this.workspace.enterEdit();
    }
  };

  private onMenu = (event: MouseEvent): void => {
    event.preventDefault();
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
      if (!this.workspace.selection.range.includes(hit.ri, hit.ci)) {
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
