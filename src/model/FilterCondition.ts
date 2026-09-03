export interface FilterConditionJson {
  ci: number;
  operator: string;
  value: string[];
}

export class FilterCondition {
  constructor(
    public ci: number,
    public operator: string,
    public value: string[],
  ) {}

  static fromJson(json: FilterConditionJson): FilterCondition {
    const value = Array.isArray(json.value) ? json.value.map(String) : [];
    return new FilterCondition(json.ci, json.operator || "in", value);
  }

  includes(text: string): boolean {
    if (this.operator === "all") {
      return true;
    }
    if (this.operator === "in") {
      return this.value.includes(text);
    }
    return false;
  }

  getData(): FilterConditionJson {
    return { ci: this.ci, operator: this.operator, value: [...this.value] };
  }
}
