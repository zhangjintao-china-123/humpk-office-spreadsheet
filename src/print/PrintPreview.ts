import type { Sheet } from "../model/Sheet";
import { Draw } from "../render/Draw";
import { paginateSheet } from "./PrintPaginator";
import { PrintPainter } from "./PrintPainter";
import { PAPER_NAMES, PRINT_SCALES, type Orientation, type PaperName, PrintSetup } from "./PrintSetup";

export class PrintPreview {
  readonly el: HTMLElement;
  readonly setup = new PrintSetup();
  private readonly painter = new PrintPainter();
  private readonly pagesEl: HTMLElement;
  private readonly countEl: HTMLElement;
  private canvases: HTMLCanvasElement[] = [];
  private sheet: Sheet | undefined;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ho-sheet-print";
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="ho-sheet-print-bar">
        <div class="ho-sheet-print-title">打印设置</div>
        <div class="ho-sheet-print-count" data-print-count></div>
        <div class="ho-sheet-print-actions">
          <button type="button" data-print-act="cancel">取消</button>
          <button type="button" data-print-act="print" class="is-primary">打印</button>
        </div>
      </div>
      <div class="ho-sheet-print-body">
        <div class="ho-sheet-print-pages" data-print-pages></div>
        <form class="ho-sheet-print-sider">
          <label>纸张
            <select data-print-field="name">${PAPER_NAMES.map((name) => `<option value="${name}">${name}</option>`).join("")}</select>
          </label>
          <label>方向
            <select data-print-field="orientation">
              <option value="landscape">横向</option>
              <option value="portrait">纵向</option>
            </select>
          </label>
          <label>上下边距
            <input data-print-field="marginY" type="number" min="0" max="200" step="1" />
          </label>
          <label>左右边距
            <input data-print-field="marginX" type="number" min="0" max="200" step="1" />
          </label>
          <label>缩放
            <select data-print-field="scale">${PRINT_SCALES.map((scale) => `<option value="${scale}">${Math.round(scale * 100)}%</option>`).join("")}</select>
          </label>
        </form>
      </div>
    `;
    this.pagesEl = this.el.querySelector("[data-print-pages]")!;
    this.countEl = this.el.querySelector("[data-print-count]")!;
    this.el.addEventListener("click", this.onClick);
    this.el.addEventListener("change", this.onChange);
    window.addEventListener("keydown", this.onKey);
    this.syncForm();
  }

  isOpen(): boolean {
    return !this.el.hidden;
  }

  open(sheet: Sheet): void {
    this.sheet = sheet;
    this.el.hidden = false;
    document.body.append(this.el);
    this.render();
  }

  close(): void {
    this.el.hidden = true;
    this.el.remove();
    this.canvases = [];
    this.pagesEl.replaceChildren();
  }

  print(): void {
    if (!this.canvases.length) {
      this.render();
    }
    const { setup } = this;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("name", "ho-sheet-print-frame");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.querySelector("iframe[name=ho-sheet-print-frame]")?.remove();
    document.body.append(iframe);
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      return;
    }
    doc.title = "打印";
    doc.head.innerHTML = `<style>
      @page { size: ${setup.name} ${setup.orientation}; margin: 0; }
      html, body { margin: 0; }
      img { display: block; width: ${setup.cssWidth}px; height: ${setup.cssHeight}px; page-break-after: always; }
      img:last-child { page-break-after: auto; }
    </style>`;
    const images = this.canvases.map((canvas) => {
      const img = doc.createElement("img");
      img.width = setup.cssWidth;
      img.height = setup.cssHeight;
      img.src = canvas.toDataURL("image/png");
      doc.body.append(img);
      return img;
    });
    const last = images[images.length - 1];
    if (!last) {
      win.print();
      return;
    }
    last.onload = () => win.print();
  }

  private render(): void {
    if (!this.sheet) {
      return;
    }
    const pages = paginateSheet(this.sheet, this.setup);
    this.countEl.textContent = `共 ${pages.length} 页`;
    this.pagesEl.replaceChildren();
    this.canvases = [];
    for (const page of pages) {
      const card = document.createElement("div");
      card.className = "ho-sheet-print-card";
      const canvas = document.createElement("canvas");
      const draw = new Draw(canvas);
      draw.resize(this.setup.cssWidth, this.setup.cssHeight);
      this.painter.paint(draw, this.sheet, page, this.setup);
      card.append(canvas);
      this.pagesEl.append(card);
      this.canvases.push(canvas);
    }
  }

  private syncForm(): void {
    this.field<HTMLSelectElement>("name").value = this.setup.name;
    this.field<HTMLSelectElement>("orientation").value = this.setup.orientation;
    this.field<HTMLInputElement>("marginX").value = String(this.setup.marginX);
    this.field<HTMLInputElement>("marginY").value = String(this.setup.marginY);
    this.field<HTMLSelectElement>("scale").value = String(this.setup.scale);
  }

  private field<T extends HTMLElement>(name: string): T {
    return this.el.querySelector<T>(`[data-print-field=${name}]`)!;
  }

  private onKey = (event: KeyboardEvent): void => {
    if (!this.isOpen() || event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    this.close();
  };

  private onClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-print-act]");
    if (button?.dataset.printAct === "cancel") {
      this.close();
    } else if (button?.dataset.printAct === "print") {
      this.print();
    }
  };

  private onChange = (event: Event): void => {
    const field = (event.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement>("[data-print-field]");
    if (!field?.dataset.printField) {
      return;
    }
    const key = field.dataset.printField;
    if (key === "name") {
      this.setup.name = field.value as PaperName;
    } else if (key === "orientation") {
      this.setup.orientation = field.value as Orientation;
    } else if (key === "marginX") {
      this.setup.marginX = Math.max(0, Number(field.value) || 0);
    } else if (key === "marginY") {
      this.setup.marginY = Math.max(0, Number(field.value) || 0);
    } else if (key === "scale") {
      this.setup.scale = Number(field.value) || 1;
    }
    this.render();
  };
}
