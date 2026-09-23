import { CellRange } from "./CellRange";
import {
  CELL_PRIORITIES,
  CELL_SHAPES,
  parsePriorityMark,
  parseShapeMark,
  type CellMark,
  type CellPriorityMark,
  type CellShapeMark,
} from "./CellMarks";
import { FilterCondition, type FilterConditionJson } from "./FilterCondition";
import { FilterSort, type FilterSortJson } from "./FilterSort";

export const FILTER_PASS = "__so_pass__";
export const FILTER_FAIL = "__so_fail__";
export const FILTER_NONE = "__so_none__";
export const FILTER_CHECKED = FILTER_PASS;
export const FILTER_UNCHECKED = FILTER_NONE;
export const FILTER_PASS_LABEL = "对";
export const FILTER_FAIL_LABEL = "错";
export const FILTER_NONE_LABEL = "无对错";
export const FILTER_CHECKED_LABEL = FILTER_PASS_LABEL;
export const FILTER_UNCHECKED_LABEL = FILTER_NONE_LABEL;
export const FILTER_PRI_NONE = "__so_pri_none__";
export const FILTER_SHAPE_NONE = "__so_shape_none__";
export const FILTER_PRI_NONE_LABEL = "无优先级";
export const FILTER_SHAPE_NONE_LABEL = "无形状";

export const FILTER_VERDICT_KEYS = [FILTER_PASS, FILTER_FAIL, FILTER_NONE] as const;

export type FilterVerdict = "pass" | "fail" | "none";
export type FilterTokenKind = "verdict" | "priority" | "shape" | "value";

export type FilterCountItem = { key: string; count: number };

export type FilterValueItem = FilterCountItem & {
  verdicts: FilterVerdict[];
  priorities: CellPriorityMark[];
  shapes: CellShapeMark[];
};

export type FilterColumnItems = {
  verdicts: FilterCountItem[];
  priorities: FilterCountItem[];
  shapes: FilterCountItem[];
  values: FilterValueItem[];
};

export function priorityFilterToken(n: CellPriorityMark): string {
  return `__so_pri_${n}__`;
}

export function shapeFilterToken(shape: CellShapeMark): string {
  return `__so_shape_${shape}__`;
}

export function isBadgeFilterValue(value: string): boolean {
  return filterTokenKind(value) !== "value";
}

export function filterVerdictOf(value: string): FilterVerdict | undefined {
  if (value === FILTER_PASS || value === "__xld_checked__") return "pass";
  if (value === FILTER_FAIL) return "fail";
  if (value === FILTER_NONE || value === "__xld_unchecked__") return "none";
  return undefined;
}

export function parsePriorityFilterToken(value: string): CellPriorityMark | "none" | undefined {
  if (value === FILTER_PRI_NONE) return "none";
  const match = /^__so_pri_(\d+)__$/.exec(value);
  return match ? parsePriorityMark(match[1]) : undefined;
}

export function parseShapeFilterToken(value: string): CellShapeMark | "none" | undefined {
  if (value === FILTER_SHAPE_NONE) return "none";
  const match = /^__so_shape_([a-z]+)__$/.exec(value);
  return match ? parseShapeMark(match[1]) : undefined;
}

export function filterTokenKind(value: string): FilterTokenKind {
  if (filterVerdictOf(value)) return "verdict";
  if (parsePriorityFilterToken(value) !== undefined) return "priority";
  if (parseShapeFilterToken(value) !== undefined) return "shape";
  return "value";
}

export function normalizeBadgeFilterValue(value: string): string {
  const flag = filterVerdictOf(value);
  if (flag === "pass") return FILTER_PASS;
  if (flag === "fail") return FILTER_FAIL;
  if (flag === "none") return FILTER_NONE;
  return value;
}

export function compactFilterSelection(selected: string[], groups: string[][]): string[] {
  const picked = selected.map(normalizeBadgeFilterValue);
  const out: string[] = [];
  for (const group of groups) {
    const chosen = group.filter((key) => picked.includes(key));
    if (chosen.length > 0 && chosen.length < group.length) {
      out.push(...chosen);
    }
  }
  return out;
}

export function commitFilterSelection(
  selected: string[],
  groups: string[][],
  dirty: { values?: boolean; icons?: boolean } = {},
): string[] {
  const iconGroups = groups.slice(0, 3);
  const valueGroup = groups[3] ?? [];
  const next = new Set(selected.map(normalizeBadgeFilterValue));
  const anyValue = valueGroup.some((key) => next.has(key));
  if (dirty.values && !dirty.icons && anyValue) {
    for (const group of iconGroups) {
      for (const key of group) next.add(key);
    }
  }
  return compactFilterSelection([...next], groups);
}

export interface AutoFilterJson {
  ref?: string;
  filters?: FilterConditionJson[];
  sort?: FilterSortJson | null;
}

export class AutoFilter {
  ref: string | null = null;
  filters: FilterCondition[] = [];
  sort: FilterSort | null = null;
  hiddenRows = new Set<number>();
  viewRows: number[] = [];

  setData(json: AutoFilterJson | undefined): void {
    this.clear();
    if (!json?.ref) {
      return;
    }
    this.ref = json.ref;
    this.filters = (json.filters ?? []).map((item) => FilterCondition.fromJson(item));
    this.sort = json.sort ? FilterSort.fromJson(json.sort) : null;
  }

  getData(): AutoFilterJson {
    if (!this.active()) {
      return {};
    }
    return {
      ref: this.ref ?? undefined,
      filters: this.filters.map((item) => item.getData()),
      sort: this.sort?.getData() ?? null,
    };
  }

  active(): boolean {
    return this.ref !== null;
  }

  clear(): void {
    this.ref = null;
    this.filters = [];
    this.sort = null;
    this.hiddenRows = new Set();
    this.viewRows = [];
  }

  range(): CellRange {
    return CellRange.valueOf(this.ref ?? "A1");
  }

  hrange(): CellRange {
    const range = this.range();
    return new CellRange(range.sri, range.sci, range.sri, range.eci);
  }

  includes(ri: number, ci: number): boolean {
    return this.active() && this.hrange().includes(ri, ci);
  }

  getFilter(ci: number): FilterCondition | undefined {
    return this.filters.find((item) => item.ci === ci);
  }

  getSort(ci: number): FilterSort | undefined {
    return this.sort?.ci === ci ? this.sort : undefined;
  }

  addFilter(ci: number, operator: string, value: string[]): void {
    const found = this.getFilter(ci);
    if (found) {
      found.operator = operator;
      found.value = value;
      return;
    }
    this.filters.push(new FilterCondition(ci, operator, value));
  }

  setSort(ci: number, order: "asc" | "desc" | undefined): void {
    this.sort = order ? new FilterSort(ci, order) : null;
  }

  items(
    ci: number,
    display: (ri: number, ci: number) => string,
    verdict?: (ri: number, ci: number) => FilterVerdict | undefined,
    mark?: (ri: number, ci: number) => CellMark | undefined,
  ): FilterColumnItems {
    const verdicts: Record<string, number> = {
      [FILTER_PASS]: 0,
      [FILTER_FAIL]: 0,
      [FILTER_NONE]: 0,
    };
    const priorities: Record<string, number> = { [FILTER_PRI_NONE]: 0 };
    const shapes: Record<string, number> = { [FILTER_SHAPE_NONE]: 0 };
    const values: Record<string, number> = {};
    const valueMeta = new Map<string, { verdicts: Set<FilterVerdict>; priorities: Set<CellPriorityMark>; shapes: Set<CellShapeMark> }>();
    if (!this.active()) {
      return emptyFilterItems();
    }
    const { sri, eri } = this.range();
    for (let ri = sri + 1; ri <= eri; ri += 1) {
      const flag = verdict?.(ri, ci) ?? "none";
      if (flag === "pass") verdicts[FILTER_PASS] += 1;
      else if (flag === "fail") verdicts[FILTER_FAIL] += 1;
      else verdicts[FILTER_NONE] += 1;
      const cellMark = mark?.(ri, ci);
      if (cellMark?.priority) {
        const key = priorityFilterToken(cellMark.priority);
        priorities[key] = (priorities[key] ?? 0) + 1;
      } else {
        priorities[FILTER_PRI_NONE] += 1;
      }
      if (cellMark?.shape) {
        const key = shapeFilterToken(cellMark.shape);
        shapes[key] = (shapes[key] ?? 0) + 1;
      } else {
        shapes[FILTER_SHAPE_NONE] += 1;
      }
      const key = display(ri, ci);
      values[key] = (values[key] ?? 0) + 1;
      let meta = valueMeta.get(key);
      if (!meta) {
        meta = { verdicts: new Set(), priorities: new Set(), shapes: new Set() };
        valueMeta.set(key, meta);
      }
      meta.verdicts.add(flag);
      if (cellMark?.priority) meta.priorities.add(cellMark.priority);
      if (cellMark?.shape) meta.shapes.add(cellMark.shape);
    }
    return {
      verdicts: FILTER_VERDICT_KEYS.map((key) => ({ key, count: verdicts[key] ?? 0 })),
      priorities: [
        ...CELL_PRIORITIES.filter((n) => (priorities[priorityFilterToken(n)] ?? 0) > 0)
          .map((n) => ({ key: priorityFilterToken(n), count: priorities[priorityFilterToken(n)] })),
        ...(priorities[FILTER_PRI_NONE] ? [{ key: FILTER_PRI_NONE, count: priorities[FILTER_PRI_NONE] }] : []),
      ],
      shapes: [
        ...CELL_SHAPES.filter((shape) => (shapes[shapeFilterToken(shape)] ?? 0) > 0)
          .map((shape) => ({ key: shapeFilterToken(shape), count: shapes[shapeFilterToken(shape)] })),
        ...(shapes[FILTER_SHAPE_NONE] ? [{ key: FILTER_SHAPE_NONE, count: shapes[FILTER_SHAPE_NONE] }] : []),
      ],
      values: Object.keys(values)
        .sort(compareFilterValue)
        .map((key) => {
          const meta = valueMeta.get(key);
          return {
            key,
            count: values[key],
            verdicts: FILTER_VERDICT_KEYS
              .map((token) => filterVerdictOf(token))
              .filter((item): item is FilterVerdict => !!item && !!meta?.verdicts.has(item)),
            priorities: CELL_PRIORITIES.filter((n) => meta?.priorities.has(n)),
            shapes: CELL_SHAPES.filter((shape) => meta?.shapes.has(shape)),
          };
        }),
    };
  }

  apply(
    rowLen: number,
    display: (ri: number, ci: number) => string,
    verdict?: (ri: number, ci: number) => FilterVerdict | undefined,
    mark?: (ri: number, ci: number) => CellMark | undefined,
  ): void {
    this.hiddenRows = new Set();
    if (!this.active()) {
      this.viewRows = [];
      return;
    }
    const range = this.range();
    for (let ri = range.sri + 1; ri <= range.eri; ri += 1) {
      if (!this.rowVisible(ri, display, verdict, mark)) {
        this.hiddenRows.add(ri);
      }
    }
    this.rebuildView(rowLen, display);
  }

  shift(axis: "row" | "column", index: number, count: number): void {
    if (!this.active()) {
      return;
    }
    const range = this.range();
    if (axis === "row") {
      range.sri = shiftIndex(range.sri, index, count);
      range.eri = shiftIndex(range.eri, index, count);
    } else {
      range.sci = shiftIndex(range.sci, index, count);
      range.eci = shiftIndex(range.eci, index, count);
    }
    this.ref = range.toString();
    for (const filter of this.filters) {
      if (axis === "column") {
        filter.ci = shiftIndex(filter.ci, index, count);
      }
    }
    if (this.sort && axis === "column") {
      this.sort.ci = shiftIndex(this.sort.ci, index, count);
    }
  }

  private rowVisible(
    ri: number,
    display: (ri: number, ci: number) => string,
    verdict?: (ri: number, ci: number) => FilterVerdict | undefined,
    mark?: (ri: number, ci: number) => CellMark | undefined,
  ): boolean {
    return this.filters.every((filter) => {
      const selected = filter.value.map(normalizeBadgeFilterValue);
      const wantedVerdict = new Set(selected.map(filterVerdictOf).filter((item): item is FilterVerdict => Boolean(item)));
      const wantedPriority = new Set(selected.map(parsePriorityFilterToken).filter((item): item is CellPriorityMark | "none" => item !== undefined));
      const wantedShape = new Set(selected.map(parseShapeFilterToken).filter((item): item is CellShapeMark | "none" => item !== undefined));
      const values = selected.filter((item) => filterTokenKind(item) === "value");
      const cellMark = mark?.(ri, filter.ci);
      const flag = verdict?.(ri, filter.ci) ?? "none";
      const priority = cellMark?.priority ?? "none";
      const shape = cellMark?.shape ?? "none";
      const verdictOk = wantedVerdict.size === 0 || wantedVerdict.has(flag);
      const priorityOk = wantedPriority.size === 0 || wantedPriority.has(priority);
      const shapeOk = wantedShape.size === 0 || wantedShape.has(shape);
      const valueOk = values.length === 0 || values.includes(display(ri, filter.ci));
      return verdictOk && priorityOk && shapeOk && valueOk;
    });
  }

  private rebuildView(rowLen: number, display: (ri: number, ci: number) => string): void {
    if (!this.active()) {
      this.viewRows = [];
      return;
    }
    const range = this.range();
    const view: number[] = [];
    for (let ri = 0; ri < range.sri; ri += 1) {
      if (!this.hiddenRows.has(ri)) {
        view.push(ri);
      }
    }
    if (!this.hiddenRows.has(range.sri)) {
      view.push(range.sri);
    }
    const mid: number[] = [];
    for (let ri = range.sri + 1; ri <= range.eri; ri += 1) {
      if (!this.hiddenRows.has(ri)) {
        mid.push(ri);
      }
    }
    this.sortRows(mid, display);
    view.push(...mid);
    for (let ri = range.eri + 1; ri < rowLen; ri += 1) {
      if (!this.hiddenRows.has(ri)) {
        view.push(ri);
      }
    }
    this.viewRows = view;
  }

  private sortRows(rows: number[], display: (ri: number, ci: number) => string): void {
    const sort = this.sort;
    if (!sort) {
      return;
    }
    const sign = sort.order === "desc" ? -1 : 1;
    rows.sort((a, b) => sign * compareFilterValue(display(a, sort.ci), display(b, sort.ci)));
  }
}

export function expandFilterRange(
  range: CellRange,
  rowLen: number,
  colLen: number,
  occupied: (ri: number, ci: number) => boolean | string,
  mergeAt?: (ri: number, ci: number) => CellRange | undefined,
): CellRange {
  let { sri, sci, eri, eci } = range;
  if (sri === eri && sci === eci) {
    const used = usedFilterBounds(rowLen, colLen, occupied);
    if (used) {
      return skipFilterBannerRows(used, occupied, mergeAt);
    }
  }
  if (sri === eri) {
    let last = sri;
    for (let ri = sri + 1; ri < rowLen; ri += 1) {
      for (let ci = sci; ci <= eci; ci += 1) {
        if (occupied(ri, ci)) {
          last = ri;
          break;
        }
      }
    }
    eri = last;
  }
  return skipFilterBannerRows(new CellRange(sri, sci, eri, eci), occupied, mergeAt);
}

function rowHasOccupied(
  ri: number,
  sci: number,
  eci: number,
  occupied: (ri: number, ci: number) => boolean | string,
): boolean {
  for (let ci = sci; ci <= eci; ci += 1) {
    if (occupied(ri, ci)) {
      return true;
    }
  }
  return false;
}

function isBannerMerge(
  merge: CellRange | undefined,
  ri: number,
  sci: number,
  eci: number,
): merge is CellRange {
  return !!merge
    && merge.sri <= ri
    && ri <= merge.eri
    && merge.sci <= sci
    && eci <= merge.eci
    && merge.colCount() > 1;
}

export function skipFilterBannerRows(
  range: CellRange,
  occupied: (ri: number, ci: number) => boolean | string,
  mergeAt?: (ri: number, ci: number) => CellRange | undefined,
): CellRange {
  if (!mergeAt) {
    return range;
  }
  let sri = range.sri;
  let skippedBanner = false;
  while (sri < range.eri) {
    const merge = mergeAt(sri, range.sci);
    if (isBannerMerge(merge, sri, range.sci, range.eci)) {
      sri = merge.eri + 1;
      skippedBanner = true;
      continue;
    }
    if (skippedBanner && !rowHasOccupied(sri, range.sci, range.eci, occupied)) {
      sri += 1;
      continue;
    }
    break;
  }
  if (sri > range.eri) {
    sri = range.eri;
  }
  if (sri === range.sri) {
    return range;
  }
  return new CellRange(sri, range.sci, range.eri, range.eci);
}

function usedFilterBounds(
  rowLen: number,
  colLen: number,
  occupied: (ri: number, ci: number) => boolean | string,
): CellRange | undefined {
  let minCi = colLen;
  let maxCi = -1;
  let maxRi = -1;
  for (let ri = 0; ri < rowLen; ri += 1) {
    for (let ci = 0; ci < colLen; ci += 1) {
      if (!occupied(ri, ci)) {
        continue;
      }
      minCi = Math.min(minCi, ci);
      maxCi = Math.max(maxCi, ci);
      maxRi = Math.max(maxRi, ri);
    }
  }
  if (maxRi < 0) {
    return undefined;
  }
  return new CellRange(0, minCi, maxRi, maxCi);
}

export function compareFilterValue(a: string, b: string): number {
  if (a === "" && b !== "") {
    return 1;
  }
  if (b === "" && a !== "") {
    return -1;
  }
  const na = Number(a);
  const nb = Number(b);
  if (a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb)) {
    return na - nb;
  }
  return a.localeCompare(b, "zh-CN");
}

function emptyFilterItems(): FilterColumnItems {
  return { verdicts: [], priorities: [], shapes: [], values: [] };
}

function shiftIndex(value: number, index: number, count: number): number {
  if (value < index) {
    return value;
  }
  return Math.max(index, value + count);
}
