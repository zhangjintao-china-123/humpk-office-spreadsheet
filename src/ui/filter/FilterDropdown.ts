import {
  commitFilterSelection,
  FILTER_FAIL,
  FILTER_NONE,
  FILTER_NONE_LABEL,
  FILTER_PASS,
  FILTER_PRI_NONE,
  FILTER_PRI_NONE_LABEL,
  FILTER_SHAPE_NONE,
  FILTER_SHAPE_NONE_LABEL,
  normalizeBadgeFilterValue,
  parsePriorityFilterToken,
  parseShapeFilterToken,
  type FilterColumnItems,
  type FilterValueItem,
} from "../../model/AutoFilter";
import {
  PRIORITY_COLORS,
  SHAPE_LABELS,
  SHAPE_MARK_COLOR,
  VERDICT_COLORS,
  VERDICT_LABELS,
  type CellPriorityMark,
  type CellVerdictMark,
} from "../../model/CellMarks";
import { shapeIconSvg, verdictIconSvg } from "../ribbon/MarkPalette";

export class FilterDropdown {
  readonly el: HTMLElement;
  private ci = 0;
  private sort: "asc" | "desc" | undefined;
  private items: FilterColumnItems = { verdicts: [], priorities: [], shapes: [], values: [] };
  private selected = new Set<string>();
  private ignoreOutside = false;
  private valuesDirty = false;
  private iconsDirty = false;
  onOk?: (ci: number, order: "asc" | "desc" | undefined, values: string[]) => void;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ho-sheet-sort-filter";
    this.el.hidden = true;
    this.el.addEventListener("mousedown", (event) => event.stopPropagation());
    this.el.addEventListener("click", this.onClick);
    document.addEventListener("mousedown", this.onDocument);
  }

  set(
    ci: number,
    items: FilterColumnItems,
    selected: string[] | undefined,
    sort: "asc" | "desc" | undefined,
  ): void {
    this.ci = ci;
    this.sort = sort;
    this.items = items;
    this.selected = restoreSelection(items, selected);
    this.valuesDirty = false;
    this.iconsDirty = false;
    this.render();
  }

  show(left: number, top: number): void {
    this.el.hidden = false;
    document.body.append(this.el);
    const pad = 8;
    const maxHeight = Math.max(240, window.innerHeight - pad * 2);
    this.el.style.maxHeight = `${maxHeight}px`;
    const width = this.el.offsetWidth || 300;
    const height = Math.min(this.el.offsetHeight || 320, maxHeight);
    const nextLeft = Math.min(Math.max(pad, left), Math.max(pad, window.innerWidth - width - pad));
    let nextTop = top;
    if (nextTop + height > window.innerHeight - pad) {
      nextTop = Math.max(pad, window.innerHeight - height - pad);
    }
    this.el.style.left = `${nextLeft}px`;
    this.el.style.top = `${nextTop}px`;
    this.ignoreOutside = true;
    window.setTimeout(() => {
      this.ignoreOutside = false;
    }, 0);
  }

  hide(): void {
    this.el.hidden = true;
    this.el.remove();
  }

  private render(): void {
    const valueOn = this.items.values.filter((item) => this.selected.has(item.key)).length;
    this.el.innerHTML = `
      <div class="ho-sheet-filter-head ho-sheet-filter-top">
        <div class="ho-sheet-filter-toggles">
          <button type="button" data-act="select-all">全选</button>
          <button type="button" data-act="clear-all">全消</button>
        </div>
      </div>
      <button type="button" class="ho-sheet-sort-item${this.sort === "asc" ? " is-on" : ""}" data-sort="asc">升序</button>
      <button type="button" class="ho-sheet-sort-item${this.sort === "desc" ? " is-on" : ""}" data-sort="desc">降序</button>
      <div class="ho-sheet-sort-split"></div>
      ${listSection("对错标志", this.items.verdicts.map((item) => listItem(item.key, item.count, this.selected.has(item.key))))}
      ${listSection("优先级图标", this.items.priorities.map((item) => listItem(item.key, item.count, this.selected.has(item.key))))}
      ${listSection("标记图标", this.items.shapes.map((item) => listItem(item.key, item.count, this.selected.has(item.key))))}
      <div class="ho-sheet-filter">
        <div class="ho-sheet-filter-head">
          <span class="ho-sheet-filter-count">按值 ${valueOn} / ${this.items.values.length}</span>
        </div>
        <div class="ho-sheet-filter-body">
          ${this.items.values.map((item) => valueItem(item, this.selected.has(item.key))).join("")}
        </div>
      </div>
      <div class="ho-sheet-filter-actions">
        <button type="button" data-act="cancel">取消</button>
        <button type="button" class="is-primary" data-act="ok">确定</button>
      </div>
    `;
  }

  private onClick = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (!target) {
      return;
    }
    if (target.dataset.sort) {
      const next = target.dataset.sort as "asc" | "desc";
      this.sort = this.sort === next ? undefined : next;
      this.el.querySelectorAll("[data-sort]").forEach((item) => {
        item.classList.toggle("is-on", item.getAttribute("data-sort") === this.sort);
      });
      return;
    }
    if (target.dataset.act === "select-all") {
      for (const item of this.items.values) this.selected.add(item.key);
      for (const key of this.iconKeys()) this.selected.add(key);
      this.valuesDirty = true;
      this.iconsDirty = true;
      this.syncChecks();
      return;
    }
    if (target.dataset.act === "clear-all") {
      for (const item of this.items.values) this.selected.delete(item.key);
      for (const key of this.iconKeys()) this.selected.delete(key);
      this.valuesDirty = true;
      this.iconsDirty = true;
      this.syncChecks();
      return;
    }
    if (target.dataset.value !== undefined) {
      this.toggleValue(target.dataset.value);
      return;
    }
    if (target.dataset.act === "ok") {
      this.onOk?.(this.ci, this.sort, commitFilterSelection([...this.selected], this.groupKeys(), {
        values: this.valuesDirty,
        icons: this.iconsDirty,
      }));
      this.hide();
      return;
    }
    if (target.dataset.act === "cancel") {
      this.hide();
    }
  };

  private toggleValue(value: string): void {
    const group = this.groupKeys().find((keys) => keys.includes(value));
    const inValues = this.items.values.some((item) => item.key === value);
    if (inValues) {
      this.valuesDirty = true;
    } else {
      this.iconsDirty = true;
    }
    if (group && !inValues && group.length > 1 && group.every((key) => this.selected.has(key))) {
      for (const key of group) this.selected.delete(key);
      this.selected.add(value);
      this.syncChecks();
      return;
    }
    if (this.selected.has(value)) {
      this.selected.delete(value);
    } else {
      this.selected.add(value);
    }
    this.syncChecks();
  }

  private iconKeys(): string[] {
    return [
      ...this.items.verdicts.map((item) => item.key),
      ...this.items.priorities.map((item) => item.key),
      ...this.items.shapes.map((item) => item.key),
    ];
  }

  private groupKeys(): string[][] {
    return [
      this.items.verdicts.map((item) => item.key),
      this.items.priorities.map((item) => item.key),
      this.items.shapes.map((item) => item.key),
      this.items.values.map((item) => item.key),
    ];
  }

  private onDocument = (event: MouseEvent): void => {
    if (this.el.hidden || this.ignoreOutside || this.el.contains(event.target as Node)) {
      return;
    }
    this.hide();
  };

  private syncChecks(): void {
    const count = this.el.querySelector(".ho-sheet-filter-count");
    if (count) {
      const valueOn = this.items.values.filter((item) => this.selected.has(item.key)).length;
      count.textContent = `按值 ${valueOn} / ${this.items.values.length}`;
    }
    this.el.querySelectorAll<HTMLElement>("[data-value]").forEach((item) => {
      item.classList.toggle("is-on", this.selected.has(item.dataset.value ?? ""));
    });
  }
}

function restoreSelection(items: FilterColumnItems, selected: string[] | undefined): Set<string> {
  const all = [
    ...items.verdicts.map((item) => item.key),
    ...items.priorities.map((item) => item.key),
    ...items.shapes.map((item) => item.key),
    ...items.values.map((item) => item.key),
  ];
  if (!selected) {
    return new Set(all);
  }
  const saved = new Set(selected.map(normalizeBadgeFilterValue));
  const next = new Set<string>();
  fillGroup(next, items.verdicts.map((item) => item.key), saved);
  fillGroup(next, items.priorities.map((item) => item.key), saved);
  fillGroup(next, items.shapes.map((item) => item.key), saved);
  if (![...saved].some((key) => items.values.some((item) => item.key === key))) {
    for (const item of items.values) next.add(item.key);
  } else {
    for (const item of items.values) {
      if (saved.has(item.key)) next.add(item.key);
    }
  }
  return next;
}

function fillGroup(target: Set<string>, keys: string[], saved: Set<string>): void {
  const chosen = keys.filter((key) => saved.has(key));
  if (chosen.length === 0) {
    for (const key of keys) target.add(key);
    return;
  }
  for (const key of chosen) target.add(key);
}

function listSection(title: string, items: string[]): string {
  if (!items.length) {
    return "";
  }
  return `
    <div class="ho-sheet-filter-group">
      <div class="ho-sheet-filter-group-label">${title}</div>
      <div class="ho-sheet-filter-list">${items.join("")}</div>
    </div>
  `;
}

function listItem(key: string, count: number, on: boolean): string {
  const visual = iconVisual(key);
  return `<button type="button" class="ho-sheet-filter-item${on ? " is-on" : ""}" data-value="${escapeAttr(key)}" title="${escapeAttr(visual.title)} (${count})"><span class="ho-sheet-filter-item-main">${visual.html}<span>${escapeHtml(visual.title)}</span></span><span>(${count})</span></button>`;
}

function iconVisual(key: string): { html: string; title: string } {
  if (key === FILTER_PASS || key === FILTER_FAIL) {
    const verdict = (key === FILTER_PASS ? "pass" : "fail") as CellVerdictMark;
    return {
      title: VERDICT_LABELS[verdict],
      html: markChip(VERDICT_COLORS[verdict], verdictIconSvg(verdict)),
    };
  }
  if (key === FILTER_NONE) {
    return { title: FILTER_NONE_LABEL, html: "" };
  }
  if (key === FILTER_PRI_NONE) {
    return { title: FILTER_PRI_NONE_LABEL, html: "" };
  }
  if (key === FILTER_SHAPE_NONE) {
    return { title: FILTER_SHAPE_NONE_LABEL, html: "" };
  }
  const priority = parsePriorityFilterToken(key);
  if (priority && priority !== "none") {
    return {
      title: `优先级 ${priority}`,
      html: markChip(PRIORITY_COLORS[priority as CellPriorityMark], String(priority)),
    };
  }
  const shape = parseShapeFilterToken(key);
  if (shape && shape !== "none") {
    return {
      title: SHAPE_LABELS[shape],
      html: markChip(SHAPE_MARK_COLOR, shapeIconSvg(shape)),
    };
  }
  return { title: key, html: "" };
}

function valueItem(item: FilterValueItem, on: boolean): string {
  const chips = [
    ...item.verdicts.filter((flag) => flag === "pass" || flag === "fail").map((flag) => {
      const verdict = flag as CellVerdictMark;
      return markChip(VERDICT_COLORS[verdict], verdictIconSvg(verdict));
    }),
    ...item.priorities.map((n) => markChip(PRIORITY_COLORS[n], String(n))),
    ...item.shapes.map((shape) => markChip(SHAPE_MARK_COLOR, shapeIconSvg(shape))),
  ].join("");
  const label = item.key === "" ? "空白" : item.key;
  return `<button type="button" class="ho-sheet-filter-item${on ? " is-on" : ""}" data-value="${escapeAttr(item.key)}"><span class="ho-sheet-filter-item-main"><span>${escapeHtml(label)}</span>${chips}</span><span>(${item.count})</span></button>`;
}

function markChip(color: string, inner: string): string {
  return `<span class="ho-sheet-mark-chip" style="background:${color}">${inner}</span>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}
