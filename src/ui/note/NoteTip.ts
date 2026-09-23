export class NoteTip {
  readonly el: HTMLElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ho-sheet-note-tip";
    this.el.hidden = true;
  }

  show(text: string, left: number, top: number): void {
    if (!text.trim()) {
      this.hide();
      return;
    }
    this.el.hidden = false;
    this.el.textContent = text;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    document.body.append(this.el);
  }

  hide(): void {
    this.el.hidden = true;
    this.el.remove();
  }

  destroy(): void {
    this.hide();
  }
}
