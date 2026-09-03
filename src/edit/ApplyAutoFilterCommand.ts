import type { AutoFilterJson } from "../model/AutoFilter";
import type { EditCommand } from "./EditCommand";
import type { EditHost } from "./EditHost";

export class ApplyAutoFilterCommand implements EditCommand {
  private before: AutoFilterJson = {};

  constructor(
    private readonly host: EditHost,
    private readonly ci: number,
    private readonly order: "asc" | "desc" | undefined,
    private readonly values: string[],
  ) {}

  do(): void {
    const sheet = this.host.sheet();
    this.before = sheet.captureFilter();
    sheet.autoFilter.addFilter(this.ci, "in", this.values);
    sheet.autoFilter.setSort(this.ci, this.order);
    sheet.refreshFilterView();
    this.host.afterChange();
  }

  undo(): void {
    this.host.sheet().restoreFilter(this.before);
    this.host.afterChange();
  }
}
