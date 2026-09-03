import type { Workspace } from "../workspace/Workspace";

export class FormulaBar {
  readonly el: HTMLElement;
  private readonly addr: HTMLInputElement;
  private readonly input: HTMLInputElement;

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
      this.workspace.enterEdit("=");
    });
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.workspace.setCellText(this.input.value);
        this.workspace.selection.move(1, 0, this.workspace.sheet());
        this.workspace.ensureVisible();
        this.workspace.render();
        this.workspace.emitUi();
      } else if (event.key === "Escape") {
        this.sync();
        this.input.blur();
      }
    });
    this.sync();
  }

  sync(): void {
    const state = this.workspace.formatState();
    this.addr.value = state.address;
    if (document.activeElement !== this.input) {
      this.input.value = state.formula;
    }
  }
}
