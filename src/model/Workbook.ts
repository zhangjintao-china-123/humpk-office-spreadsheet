import { Sheet } from "./Sheet";

const INVALID_SHEET_CHARS = /[:\\/?*[\]]/;
const CHECKMARKS_NAME = "__xld_checkmarks";
const EDITABLES_NAME = "__so_editables";
const CELL_MARKS_NAME = "__so_cell_marks";

export function validateSheetName(name: string, sheets: Sheet[], index: number): string | undefined {
  const next = name.trim();
  if (!next) {
    return "工作表名称不能为空";
  }
  if (next.length > 31) {
    return "工作表名称不能超过 31 个字符";
  }
  if (INVALID_SHEET_CHARS.test(next)) {
    return "工作表名称不能包含 : \\ / ? * [ ]";
  }
  if (next.startsWith("'") || next.endsWith("'")) {
    return "工作表名称不能以引号开头或结尾";
  }
  if (next === CHECKMARKS_NAME || next === EDITABLES_NAME || next === CELL_MARKS_NAME) {
    return "该名称不可用";
  }
  const taken = sheets.some((sheet, i) => (
    i !== index && sheet.name.trim().toLowerCase() === next.toLowerCase()
  ));
  if (taken) {
    return "已存在同名工作表";
  }
  return undefined;
}

export class Workbook {
  sheets: Sheet[] = [];
  activeIndex = 0;
  /** 模版开启「编辑控制」后，使用该模版的表格会锁定未标记格。 */
  keepEditables = false;
  /** 文件里写过编辑控制隐藏页（含 enabled=off）。用来区分「从未配置」和「明确关闭」。 */
  editControlConfigured = false;
  /** 普通表填充态：未标记的单元格不可编辑。 */
  enforceEditLock = false;

  static blank(name = "Sheet1"): Workbook {
    const book = new Workbook();
    book.sheets.push(new Sheet(name));
    return book;
  }

  active(): Sheet {
    return this.sheets[this.activeIndex] ?? this.sheets[0];
  }

  addSheet(name?: string): Sheet {
    const sheet = new Sheet(name ?? this.uniqueSheetName());
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

  moveSheet(from: number, to: number): boolean {
    const count = this.sheets.length;
    if (count < 2 || from === to) {
      return false;
    }
    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      return false;
    }
    if (from < 0 || to < 0 || from >= count || to >= count) {
      return false;
    }
    const [sheet] = this.sheets.splice(from, 1);
    if (!sheet) {
      return false;
    }
    this.sheets.splice(to, 0, sheet);
    if (this.activeIndex === from) {
      this.activeIndex = to;
    } else if (from < this.activeIndex && to >= this.activeIndex) {
      this.activeIndex -= 1;
    } else if (from > this.activeIndex && to <= this.activeIndex) {
      this.activeIndex += 1;
    }
    return true;
  }

  renameSheet(index: number, name: string): boolean {
    const sheet = this.sheets[index];
    const next = name.trim();
    if (!sheet || validateSheetName(next, this.sheets, index)) {
      return false;
    }
    sheet.name = next;
    return true;
  }

  uniqueSheetName(prefix = "Sheet"): string {
    let n = this.sheets.length + 1;
    let name = `${prefix}${n}`;
    while (this.sheets.some((sheet) => sheet.name.trim().toLowerCase() === name.toLowerCase())) {
      n += 1;
      name = `${prefix}${n}`;
    }
    return name;
  }

  setActive(index: number): void {
    if (index >= 0 && index < this.sheets.length) {
      this.activeIndex = index;
    }
  }
}
