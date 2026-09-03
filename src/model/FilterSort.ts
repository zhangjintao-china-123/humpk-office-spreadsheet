export interface FilterSortJson {
  ci: number;
  order: "asc" | "desc";
}

export class FilterSort {
  constructor(
    public ci: number,
    public order: "asc" | "desc",
  ) {}

  static fromJson(json: FilterSortJson): FilterSort {
    return new FilterSort(json.ci, json.order === "desc" ? "desc" : "asc");
  }

  getData(): FilterSortJson {
    return { ci: this.ci, order: this.order };
  }
}
