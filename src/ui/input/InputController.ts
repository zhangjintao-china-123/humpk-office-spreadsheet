import { CellNavigator } from "../../selection/CellNavigator";
import { isDirectLatinInput, isLatinKeyCode } from "./ImeGuard";
import type { Workspace } from "../workspace/Workspace";

export class InputController {
  private composing = false;

  constructor(private readonly workspace: Workspace) {}

  attach(host: HTMLElement): void {
    window.addEventListener("keydown", this.onFindKey, true);
    window.addEventListener("keydown", this.onKey);
    const capture = this.workspace.capture;
    capture.addEventListener("compositionstart", this.onComposeStart);
    capture.addEventListener("compositionend", this.onComposeEnd);
    capture.addEventListener("input", this.onCaptureInput);
    this.workspace.editor.addEventListener("keydown", this.onEditorKey);
    this.workspace.editor.addEventListener("blur", this.onBlur);
    host.setAttribute("tabindex", "-1");
  }

  detach(): void {
    window.removeEventListener("keydown", this.onFindKey, true);
    window.removeEventListener("keydown", this.onKey);
  }

  private onComposeStart = (): void => {
    this.composing = true;
    this.workspace.capture.classList.add("is-ime");
    this.workspace.placeCapture();
  };

  private onComposeEnd = (event: CompositionEvent): void => {
    this.composing = false;
    this.workspace.capture.classList.remove("is-ime");
    const text = event.data || this.workspace.capture.value;
    this.workspace.capture.value = "";
    if (text) {
      this.workspace.enterEdit(text);
    } else {
      this.workspace.focusGrid();
    }
  };

  private onCaptureInput = (event: Event): void => {
    if (this.composing) {
      return;
    }
    const text = (event.target as HTMLInputElement).value;
    window.setTimeout(() => {
      if (this.composing || !isDirectLatinInput(this.composing, text)) {
        return;
      }
      this.workspace.capture.value = "";
      this.workspace.enterEdit(text);
    }, 0);
  };

  private onKey = (event: KeyboardEvent): void => {
    const ws = this.workspace;
    if (event.target === ws.editor || (isField(event.target) && event.target !== ws.capture)) {
      return;
    }
    if (event.target instanceof HTMLElement && event.target.closest(".ho-sheet-formulabar")) {
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".ho-sheet-formulabar")) {
      return;
    }
    if (event.isComposing || this.composing) {
      if (event.key === "Escape") {
        this.composing = false;
        ws.capture.classList.remove("is-ime");
        ws.capture.value = "";
      }
      return;
    }
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key;
    if (this.handleFind(event, meta, key)) {
      return;
    }
    if (this.handleMeta(event, meta, key)) {
      return;
    }
    if (this.handleImage(event, key)) {
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      ws.clearClipboard();
      return;
    }
    if (this.handleNavigation(event, meta, key)) {
      return;
    }
    if (key === "F2") {
      event.preventDefault();
      if (event.shiftKey) {
        ws.editNote();
        return;
      }
      ws.enterEdit();
      return;
    }
    if (!meta && !event.altKey && isLatinKeyCode(event.keyCode, key)) {
      event.preventDefault();
      ws.enterEdit(key);
    }
  };

  private onFindKey = (event: KeyboardEvent): void => {
    if (!this.shouldHandleFind(event)) {
      return;
    }
    this.handleFind(event, event.metaKey || event.ctrlKey, event.key);
  };

  private shouldHandleFind(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return true;
    }
    if (target.closest(".ho-sheet-find, .ho-sheet-app, .ho-sheet-workspace, .ho-sheet-ribbon, .ho-sheet-formulabar, .so-sheet-host")) {
      return true;
    }
    if (target.closest("input, textarea, select, [contenteditable], .ant-modal")) {
      return false;
    }
    return this.workspace.root.contains(target) || target === document.body;
  }

  private handleFind(event: KeyboardEvent, meta: boolean, key: string): boolean {
    if (this.workspace.editing && event.target === this.workspace.editor && !meta && key !== "F3") {
      return false;
    }
    const lower = key.toLowerCase();
    if (meta && lower === "f") {
      event.preventDefault();
      event.stopPropagation();
      this.workspace.openFind("find");
      return true;
    }
    if (meta && lower === "h") {
      event.preventDefault();
      event.stopPropagation();
      this.workspace.openFind("replace");
      return true;
    }
    if (key === "F3") {
      event.preventDefault();
      event.stopPropagation();
      this.workspace.findNext(event.shiftKey);
      return true;
    }
    return false;
  }

  private handleMeta(event: KeyboardEvent, meta: boolean, key: string): boolean {
    if (!meta) {
      return false;
    }
    const ws = this.workspace;
    const lower = key.toLowerCase();
    if (lower === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        ws.history.redo();
      } else {
        ws.history.undo();
      }
      ws.emitUi();
      return true;
    }
    if (lower === "y") {
      event.preventDefault();
      ws.history.redo();
      ws.emitUi();
      return true;
    }
    if (lower === "b") {
      event.preventDefault();
      ws.applyFormat({ type: "bold" });
      return true;
    }
    if (lower === "i") {
      event.preventDefault();
      ws.applyFormat({ type: "italic" });
      return true;
    }
    if (lower === "u") {
      event.preventDefault();
      ws.applyFormat({ type: "underline" });
      return true;
    }
    if (lower === "c") {
      event.preventDefault();
      void copyText(ws.copy());
      return true;
    }
    if (lower === "x") {
      event.preventDefault();
      void copyText(ws.cut());
      return true;
    }
    if (lower === "v") {
      event.preventDefault();
      void pasteText().then((text) => {
        if (ws.clipboard.payload) {
          ws.pasteInternal();
        } else if (text) {
          ws.pasteTsv(text);
        }
      });
      return true;
    }
    if (lower === "p") {
      event.preventDefault();
      ws.printPreview();
      return true;
    }
    if (lower === "m" && event.shiftKey) {
      event.preventDefault();
      ws.unmarkSelection();
      return true;
    }
    if (lower === "a") {
      event.preventDefault();
      ws.selectImage(undefined);
      ws.selection.selectAll(ws.sheet().rows.len, ws.sheet().cols.len);
      ws.render();
      ws.emitUi();
      return true;
    }
    if (key === " ") {
      event.preventDefault();
      ws.selectImage(undefined);
      const range = ws.selection.range;
      ws.selection.selectCols(range.sci, range.eci, ws.sheet().rows.len);
      ws.ensureVisible();
      ws.render();
      ws.emitUi();
      return true;
    }
    return false;
  }

  private handleImage(event: KeyboardEvent, key: string): boolean {
    const ws = this.workspace;
    if (ws.selectedImageId === undefined) {
      return false;
    }
    if (key === "Delete" || key === "Backspace") {
      event.preventDefault();
      ws.deleteSelectedImage();
      return true;
    }
    if (key === "Escape") {
      event.preventDefault();
      ws.selectImage(undefined);
      ws.render();
      ws.emitUi();
      return true;
    }
    const move = arrowMove(key);
    if (move) {
      event.preventDefault();
      ws.nudgeImage(move[0], move[1], event.shiftKey ? 10 : 1);
      return true;
    }
    return true;
  }

  private handleNavigation(event: KeyboardEvent, meta: boolean, key: string): boolean {
    const ws = this.workspace;
    const sheet = ws.sheet();
    if (key === "Delete" || key === "Backspace") {
      event.preventDefault();
      ws.clearSelection();
      return true;
    }
    if (key === " " && event.shiftKey) {
      event.preventDefault();
      ws.selection.selectRows(ws.selection.range.sri, ws.selection.range.eri, sheet.cols.len);
      ws.render();
      ws.emitUi();
      return true;
    }
    if (key === "Enter") {
      event.preventDefault();
      ws.selection.move(event.shiftKey ? -1 : 1, 0, sheet);
      finishMove(ws);
      return true;
    }
    if (key === "Tab") {
      event.preventDefault();
      ws.selection.move(0, event.shiftKey ? -1 : 1, sheet);
      finishMove(ws);
      return true;
    }
    if (key === "Home") {
      event.preventDefault();
      this.goHome(event.shiftKey, meta);
      return true;
    }
    if (key === "End") {
      event.preventDefault();
      this.goEnd(event.shiftKey, meta);
      return true;
    }
    if (key === "PageUp" || key === "PageDown") {
      event.preventDefault();
      const delta = (key === "PageDown" ? 1 : -1) * ws.pageRowCount();
      if (event.shiftKey) {
        ws.selection.extend(delta, 0, sheet);
      } else {
        ws.selection.move(delta, 0, sheet);
      }
      finishMove(ws);
      return true;
    }
    const move = arrowMove(key);
    if (!move) {
      return false;
    }
    event.preventDefault();
    if (meta && event.shiftKey) {
      ws.selection.jumpExtend(move[0], move[1], sheet);
    } else if (meta) {
      ws.selection.jump(move[0], move[1], sheet);
    } else if (event.shiftKey) {
      ws.selection.extend(move[0], move[1], sheet);
    } else {
      ws.selection.move(move[0], move[1], sheet);
    }
    finishMove(ws);
    return true;
  }

  private goHome(shift: boolean, meta: boolean): void {
    const ws = this.workspace;
    const sheet = ws.sheet();
    const ri = meta ? 0 : ws.selection.ri;
    const ci = 0;
    if (shift) {
      ws.selection.extendTo(ri, ci, sheet);
    } else {
      ws.selection.set(ri, ci, sheet);
    }
    finishMove(ws);
  }

  private goEnd(shift: boolean, meta: boolean): void {
    const ws = this.workspace;
    const sheet = ws.sheet();
    const last = CellNavigator.lastUsed(sheet);
    const ri = meta ? last.ri : ws.selection.ri;
    const ci = meta ? last.ci : CellNavigator.lastUsedInRow(sheet, ws.selection.ri);
    if (shift) {
      ws.selection.extendTo(ri, ci, sheet);
    } else {
      ws.selection.set(ri, ci, sheet);
    }
    finishMove(ws);
  }

  private onEditorKey = (event: KeyboardEvent): void => {
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    const ws = this.workspace;
    const editor = ws.editor;
    if (event.key === "Enter" && event.altKey) {
      event.preventDefault();
      insertNewline(editor);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      ws.commitEdit(event.shiftKey ? "up" : "down");
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      ws.commitEdit(event.shiftKey ? "left" : "right");
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      ws.cancelEdit();
      ws.render();
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      ws.toggleFormulaMode();
      return;
    }
    if (event.key.startsWith("Arrow") && ws.nudgeFormulaPoint(...arrowNudge(event))) {
      event.preventDefault();
      return;
    }
    if (ws.isFormulaEditing() && event.key.startsWith("Arrow")) {
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      ws.commitEdit("up");
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      ws.commitEdit("down");
      return;
    }
    if (event.key === "ArrowLeft" && editor.selectionStart === 0 && editor.selectionEnd === 0) {
      event.preventDefault();
      ws.commitEdit("left");
      return;
    }
    if (
      event.key === "ArrowRight"
      && editor.selectionStart === editor.value.length
      && editor.selectionEnd === editor.value.length
    ) {
      event.preventDefault();
      ws.commitEdit("right");
    }
  };

  private onBlur = (event: FocusEvent): void => {
    if (!this.workspace.editing) {
      return;
    }
    this.workspace.commitEdit("none");
    if (!isField(event.relatedTarget)) {
      this.workspace.focusCapture();
    }
  };
}

function finishMove(ws: Workspace): void {
  ws.ensureVisible();
  ws.applyPaintFormat();
  ws.render();
  ws.emitUi();
}

function insertNewline(editor: HTMLTextAreaElement): void {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  editor.value = `${editor.value.slice(0, start)}\n${editor.value.slice(end)}`;
  editor.selectionStart = editor.selectionEnd = start + 1;
}

function arrowNudge(event: KeyboardEvent): [number, number, boolean] {
  if (event.key === "ArrowUp") {
    return [-1, 0, event.shiftKey];
  }
  if (event.key === "ArrowDown") {
    return [1, 0, event.shiftKey];
  }
  if (event.key === "ArrowLeft") {
    return [0, -1, event.shiftKey];
  }
  return [0, 1, event.shiftKey];
}

function arrowMove(key: string): [number, number] | undefined {
  if (key === "ArrowUp") {
    return [-1, 0];
  }
  if (key === "ArrowDown") {
    return [1, 0];
  }
  if (key === "ArrowLeft") {
    return [0, -1];
  }
  if (key === "ArrowRight") {
    return [0, 1];
  }
  return undefined;
}

function isField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return !!target.closest("input, select, textarea, [contenteditable], .ho-sheet-find, .ho-sheet-print");
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

async function pasteText(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}
