import { CellRange } from "./CellRange";
import { FilterCondition, type FilterConditionJson } from "./FilterCondition";
import { FilterSort, type FilterSortJson } from "./FilterSort";

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

  items(ci: number, display: (ri: number, ci: number) => string): Record<string, number> {
    const counts: Record<string, number> = {};
    if (!this.active()) {
      return counts;
    }
    const { sri, eri } = this.range();
    for (let ri = sri + 1; ri <= eri; ri += 1) {
      const key = display(ri, ci);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  apply(rowLen: number, display: (ri: number, ci: number) => string): void {
    this.hiddenRows = new Set();
    if (!this.active()) {
      this.viewRows = [];
      return;
    }
    const range = this.range();
    for (let ri = range.sri + 1; ri <= range.eri; ri += 1) {
      if (!this.rowVisible(ri, display)) {
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

  private rowVisible(ri: number, display: (ri: number, ci: number) => string): boolean {
    return this.filters.every((filter) => filter.includes(display(ri, filter.ci)));
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
  display: (ri: number, ci: number) => string,
): CellRange {
  let { sri, sci, eri, eci } = range;
  if (sri === eri && sci === eci) {
    while (eci + 1 < colLen && display(sri, eci + 1)) {
      eci += 1;
    }
  }
  if (sri === eri) {
    let last = sri;
    for (let ri = sri + 1; ri < rowLen; ri += 1) {
      let any = false;
      for (let ci = sci; ci <= eci; ci += 1) {
        if (display(ri, ci)) {
          any = true;
          break;
        }
      }
      if (!any) {
        break;
      }
      last = ri;
    }
    eri = last;
  }
  return new CellRange(sri, sci, eri, eci);
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

function shiftIndex(value: number, index: number, count: number): number {
  if (value < index) {
    return value;
  }
  return Math.max(index, value + count);
}
