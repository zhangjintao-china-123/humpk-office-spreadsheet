import type { Workspace } from "../workspace/Workspace";

export class FormulaBar {
  readonly el: HTMLElement;
  private readonly addr: HTMLInputElement;
  private readonly input: HTMLInputElement;
  private editing = false;
  private committing = false;

  constructor(host: HTMLElement, private readonly workspace: Workspace) {
    this.el = host;
    host.classList.add("ho-sheet-formulabar");
    host.innerHTML = `
      <input class="ho-sheet-addr" readonly />
      <span class="ho-sheet-fx">fx</span>
      <input class="ho-sheet-fx-input" />
    `;
    this.addr = host.querySelector(".ho-sheet-addr")!;
    this.input = host.querySelector(".ho-sheet-fx-input")!;
    host.querySelector(".ho-sheet-fx")!.addEventListener("click", () => {
      if (!this.workspace.canEditCell()) {
        this.workspace.onLockedEdit?.();
        return;
      }
      this.input.focus();
      if (!this.input.value.startsWith("=")) {
        this.input.value = "=";
      }
      this.editing = true;
      this.workspace.cancelCaptureFocus();
      this.startSession();
    });
    this.input.addEventListener("focus", () => {
      if (!this.workspace.canEditCell()) {
        this.input.blur();
        return;
      }
      this.editing = true;
      this.workspace.cancelCaptureFocus();
      this.startSession();
    });
    this.input.addEventListener("mousedown", (event) => {
      event.stopPropagation();
      this.workspace.cancelCaptureFocus();
      if (!this.workspace.canEditCell()) {
        this.workspace.onLockedEdit?.();
      }
    });
    this.input.addEventListener("input", () => {
      this.workspace.updateFormulaEdit(this.input.value, this.input.selectionStart ?? this.input.value.length);
    });
    this.input.addEventListener("keyup", () => {
      if (this.workspace.formulaSession) {
        this.workspace.updateFormulaEdit(this.input.value, this.input.selectionStart ?? this.input.value.length);
      }
    });
    this.input.addEventListener("click", () => {
      if (this.workspace.formulaSession) {
        this.workspace.updateFormulaEdit(this.input.value, this.input.selectionStart ?? this.input.value.length);
      }
    });
    this.input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "F2") {
        event.preventDefault();
        this.workspace.toggleFormulaMode();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        this.commit("down");
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancel();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        this.commit("right");
        return;
      }
      if (event.key.startsWith("Arrow") && this.workspace.nudgeFormulaPoint(...arrowDelta(event))) {
        event.preventDefault();
      }
    });
    this.input.addEventListener("blur", () => {
      if (this.committing || !this.editing) {
        return;
      }
      window.setTimeout(() => {
        if (this.committing || !this.editing || document.activeElement === this.input) {
          return;
        }
        if (this.workspace.root.contains(document.activeElement)) {
          return;
        }
        this.commit("none");
      }, 0);
    });
    this.workspace.formulaBarCommit = () => this.commitIfEditing();
    this.workspace.formulaBarApply = (text, cursor) => {
      this.editing = true;
      this.input.value = text;
      const pos = Math.min(cursor, text.length);
      this.input.focus();
      this.input.setSelectionRange(pos, pos);
    };
    this.sync();
  }

  commitIfEditing(): void {
    if (this.committing || !this.editing || this.workspace.isFormulaEditing()) {
      return;
    }
    this.commit("none");
  }

  private startSession(): void {
    const cursor = this.input.selectionStart ?? this.input.value.length;
    this.workspace.beginFormulaEdit("bar", this.input.value, cursor, "edit");
  }

  private cancel(): void {
    this.committing = true;
    this.editing = false;
    this.workspace.endFormulaEdit();
    this.input.blur();
    this.committing = false;
    this.sync();
    this.workspace.focusCapture();
  }

  private commit(move: "down" | "right" | "none"): void {
    if (this.committing) {
      return;
    }
    this.committing = true;
    const text = this.input.value;
    this.editing = false;
    this.workspace.endFormulaEdit();
    this.input.blur();
    if (this.workspace.canEditCell()) {
      this.workspace.setCellText(text);
    }
    if (move === "right") {
      this.workspace.selection.move(0, 1, this.workspace.sheet());
    } else if (move === "down") {
      this.workspace.selection.move(1, 0, this.workspace.sheet());
    }
    this.workspace.ensureVisible();
    this.workspace.render();
    this.workspace.emitUi();
    this.workspace.focusCapture();
    this.committing = false;
  }

  sync(): void {
    const state = this.workspace.formatState();
    this.addr.value = state.address;
    if (this.editing || this.committing || document.activeElement === this.input) {
      return;
    }
    this.input.value = state.formula;
    this.input.readOnly = state.templateLocked && !state.cellEditable;
  }
}

function arrowDelta(event: KeyboardEvent): [number, number, boolean] {
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
