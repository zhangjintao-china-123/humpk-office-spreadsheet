import { Sheet } from "./Sheet";

export class Workbook {
  sheets: Sheet[] = [];
  activeIndex = 0;

  static blank(name = "Sheet1"): Workbook {
    const book = new Workbook();
    book.sheets.push(new Sheet(name));
    return book;
  }

  active(): Sheet {
    return this.sheets[this.activeIndex] ?? this.sheets[0];
  }

  addSheet(name?: string): Sheet {
    const sheet = new Sheet(name ?? `Sheet${this.sheets.length + 1}`);
    this.sheets.push(sheet);
    this.activeIndex = this.sheets.length - 1;
    return sheet;
  }

  deleteSheet(index: number): void {
    if (this.sheets.length <= 1) {
      return;
    }
    this.sheets.splice(index, 1);
    this.activeIndex = Math.min(this.activeIndex, this.sheets.length - 1);
  }

  renameSheet(index: number, name: string): void {
    const sheet = this.sheets[index];
    if (sheet) {
      sheet.name = name;
    }
  }

  setActive(index: number): void {
    if (index >= 0 && index < this.sheets.length) {
      this.activeIndex = index;
    }
  }
}
