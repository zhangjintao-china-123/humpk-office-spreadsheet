import type { Workbook } from "../../model/Workbook";
import { XlsxReader } from "./XlsxReader";
import { XlsxWriter } from "./XlsxWriter";

export type ApplyTemplateLockResult = {
  appliedSheets: number;
  markCount: number;
  enabled: boolean;
  clearedLock: boolean;
};

/** 从模版新建表格时套锁：选项关闭则去掉编辑控制，使用侧不再限制格子。 */
export async function stampTemplateLock(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const book = await new XlsxReader().read(buffer);
  prepareTemplateWorkbook(book);
  return new XlsxWriter().write(book);
}

/** 用模版整表替换当前表：原内容清空，再写入模版格子、标记和编辑限制。 */
export function applyTemplateToWorkbook(target: Workbook, template: Workbook): ApplyTemplateLockResult {
  prepareTemplateWorkbook(template);
  target.sheets = template.sheets;
  target.activeIndex = template.activeIndex;
  target.keepEditables = template.keepEditables;
  target.enforceEditLock = template.enforceEditLock;
  target.editControlConfigured = template.editControlConfigured;
  return {
    appliedSheets: template.sheets.length,
    markCount: template.sheets.reduce((count, sheet) => count + sheet.listCellMarks().length, 0),
    enabled: template.keepEditables,
    clearedLock: !template.keepEditables,
  };
}

function prepareTemplateWorkbook(book: Workbook): void {
  if (book.keepEditables) {
    book.keepEditables = true;
    book.enforceEditLock = true;
    return;
  }
  book.keepEditables = false;
  book.enforceEditLock = false;
  for (const sheet of book.sheets) {
    sheet.setEditableCells([]);
    sheet.setCellControls([]);
  }
}
