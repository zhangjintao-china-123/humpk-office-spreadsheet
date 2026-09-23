export class NoteEditor {
  readonly el: HTMLElement;
  private readonly textarea: HTMLTextAreaElement;
  private ri = 0;
  private ci = 0;
  private ignoreOutside = false;
  onSave?: (ri: number, ci: number, text: string) => void;
  onDelete?: (ri: number, ci: number) => void;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ho-sheet-note-editor";
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="ho-sheet-note-editor-title">单元格备注</div>
      <textarea class="ho-sheet-note-editor-text" rows="5" spellcheck="false" placeholder="输入备注"></textarea>
      <div class="ho-sheet-note-editor-actions">
        <button type="button" data-act="delete">删除</button>
        <span class="ho-sheet-note-editor-spacer"></span>
        <button type="button" data-act="cancel">取消</button>
        <button type="button" class="is-primary" data-act="ok">确定</button>
      </div>
    `;
    this.textarea = this.el.querySelector("textarea")!;
    this.el.addEventListener("mousedown", (event) => event.stopPropagation());
    this.el.addEventListener("click", this.onClick);
    this.textarea.addEventListener("keydown", this.onKey);
    document.addEventListener("mousedown", this.onDocument);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(ri: number, ci: number, text: string, left: number, top: number): void {
    this.ri = ri;
    this.ci = ci;
    this.textarea.value = text;
    this.move(left, top);
    this.el.hidden = false;
    document.body.append(this.el);
    this.ignoreOutside = true;
    window.setTimeout(() => {
      this.ignoreOutside = false;
      this.textarea.focus();
      this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length);
    }, 0);
  }

  move(left: number, top: number): void {
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  hide(): void {
    this.el.hidden = true;
    this.el.remove();
  }

  destroy(): void {
    document.removeEventListener("mousedown", this.onDocument);
    this.hide();
  }

  private onClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
    const act = button?.dataset.act;
    if (act === "ok") {
      this.onSave?.(this.ri, this.ci, this.textarea.value);
      this.hide();
    } else if (act === "cancel") {
      this.hide();
    } else if (act === "delete") {
      this.onDelete?.(this.ri, this.ci);
      this.hide();
    }
  };

  private onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.hide();
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.onSave?.(this.ri, this.ci, this.textarea.value);
      this.hide();
    }
  };

  private onDocument = (event: MouseEvent): void => {
    if (this.ignoreOutside || this.el.hidden || this.el.contains(event.target as Node)) {
      return;
    }
    this.onSave?.(this.ri, this.ci, this.textarea.value);
    this.hide();
  };
}
