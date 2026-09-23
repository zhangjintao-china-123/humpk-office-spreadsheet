import {
  CELL_PRIORITIES,
  CELL_SHAPES,
  CELL_VERDICTS,
  PRIORITY_COLORS,
  SHAPE_LABELS,
  SHAPE_MARK_COLOR,
  VERDICT_COLORS,
  VERDICT_LABELS,
  type CellShapeMark,
  type CellVerdictMark,
} from "../../model/CellMarks";

export function noteMarkMenuMarkup(): string {
  return `
    <div class="ho-sheet-mark-menu">
      <div class="ho-sheet-mark-label">对错标志</div>
      <div class="ho-sheet-mark-grid ho-sheet-mark-verdicts">
        ${CELL_VERDICTS.map((verdict) => verdictChip(verdict)).join("")}
      </div>
      <div class="ho-sheet-mark-label">优先级图标</div>
      <div class="ho-sheet-mark-grid ho-sheet-mark-priorities">
        ${CELL_PRIORITIES.map((n) => priorityChip(n)).join("")}
      </div>
      <div class="ho-sheet-mark-label">标记图标</div>
      <div class="ho-sheet-mark-grid ho-sheet-mark-shapes">
        ${CELL_SHAPES.map((shape) => shapeChip(shape)).join("")}
      </div>
      <button type="button" data-act="unmark">清除标记</button>
      <button type="button" data-act="unmark-sheet">清除本页全部标记</button>
      <div class="ho-sheet-contextmenu-split"></div>
      <button type="button" data-act="edit-note">插入/编辑备注</button>
      <button type="button" data-act="delete-note">删除备注</button>
    </div>
  `;
}

function verdictChip(verdict: CellVerdictMark): string {
  return `<button type="button" class="ho-sheet-mark-chip" data-verdict="${verdict}" title="${VERDICT_LABELS[verdict]}" style="background:${VERDICT_COLORS[verdict]}">${verdictIconSvg(verdict)}</button>`;
}

function priorityChip(n: number): string {
  return `<button type="button" class="ho-sheet-mark-chip" data-priority="${n}" title="优先级 ${n}" style="background:${PRIORITY_COLORS[n as 1]}">${n}</button>`;
}

function shapeChip(shape: CellShapeMark): string {
  return `<button type="button" class="ho-sheet-mark-chip" data-shape="${shape}" title="${SHAPE_LABELS[shape]}" style="background:${SHAPE_MARK_COLOR}">${shapeIconSvg(shape)}</button>`;
}

export function verdictIconSvg(verdict: CellVerdictMark): string {
  return verdict === "pass"
    ? `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3.6 8.2 6.6 11.1 12.4 4.8"/></svg>`
    : `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="M4.4 4.4 11.6 11.6M11.6 4.4 4.4 11.6"/></svg>`;
}

export function shapeIconSvg(shape: CellShapeMark): string {
  const common = `fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
  if (shape === "star") {
    return `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path ${common} d="M8 2.4 9.6 6.1l4 .3-3.1 2.6.9 3.9L8 10.8 4.6 12.9l.9-3.9-3.1-2.6 4-.3z"/></svg>`;
  }
  if (shape === "flag") {
    return `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path ${common} d="M5 2.8v10.4M5 3.2h6.2L9.4 6.2 11.2 9H5"/></svg>`;
  }
  if (shape === "diamond") {
    return `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path ${common} d="M8 2.6 13.2 8 8 13.4 2.8 8z"/></svg>`;
  }
  if (shape === "square") {
    return `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect ${common} x="3.4" y="3.4" width="9.2" height="9.2" rx="0.8"/></svg>`;
  }
  return `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path ${common} d="M8 3.1 13.4 12.6H2.6z"/></svg>`;
}
