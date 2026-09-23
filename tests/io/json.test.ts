import { describe, expect, it } from "vitest";
import { WorkbookReader } from "../../src/io/json/WorkbookReader";
import { WorkbookWriter } from "../../src/io/json/WorkbookWriter";
import { Sheet } from "../../src/model/Sheet";
import { Workbook } from "../../src/model/Workbook";

describe("json io", () => {
  it("roundtrips a sheet array", () => {
    const book = Workbook.blank("收入");
    book.active().rows.setCellText(0, 0, "hello");
    book.active().rows.setCellText(1, 1, "=A1");
    book.active().styles.push({ font: { bold: true } });
    book.active().rows.getCellOrNew(0, 0).style = 0;
    const json = new WorkbookWriter().write(book);
    const loaded = new WorkbookReader().read(json);
    expect(loaded.sheets[0].name).toBe("收入");
    expect(loaded.sheets[0].getCell(0, 0)?.text).toBe("hello");
    expect(loaded.sheets[0].getCell(0, 0)?.style).toBe(0);
  });

  it("roundtrips uploadimages", () => {
    const book = Workbook.blank("图");
    book.active().images.add({
      id: 1,
      url: "data:image/png;base64,abc",
      options: { left: 120, top: 90, width: 40, height: 20, scaleX: 2, scaleY: 1 },
    });
    const json = new WorkbookWriter().write(book);
    expect(json[0].uploadimages).toHaveLength(1);
    const loaded = new WorkbookReader().read(json);
    const image = loaded.sheets[0].images.get(1);
    expect(image?.url).toBe("data:image/png;base64,abc");
    expect(image?.options.left).toBe(120);
    expect(image?.options.scaleX).toBe(2);
  });

  it("accepts a single sheet object and ignores unknown fields", () => {
    const loaded = new WorkbookReader().read({
      name: "Sheet1",
      freeze: "B2",
      validations: [{ ref: "A1" }],
      autofilter: {},
      uploadimages: [],
      rows: { 0: { cells: { 0: { text: "x" } } } },
    });
    expect(loaded.sheets).toHaveLength(1);
    expect(loaded.sheets[0].getCell(0, 0)?.text).toBe("x");
    expect(loaded.sheets[0].freeze).toEqual([1, 1]);
  });

  it("roundtrips freeze address", () => {
    const book = Workbook.blank("冻");
    book.active().setFreeze(2, 1);
    const json = new WorkbookWriter().write(book);
    expect(json[0].freeze).toBe("B3");
    const loaded = new WorkbookReader().read(json);
    expect(loaded.sheets[0].freeze).toEqual([2, 1]);
  });

  it("roundtrips autofilter and reapplies hidden rows", () => {
    const book = Workbook.blank("筛");
    const sheet = book.active();
    sheet.rows.setCellText(0, 0, "城市");
    sheet.rows.setCellText(1, 0, "北京");
    sheet.rows.setCellText(2, 0, "上海");
    sheet.autoFilter.setData({
      ref: "A1:A3",
      filters: [{ ci: 0, operator: "in", value: ["北京"] }],
    });
    sheet.refreshFilterView();
    const json = new WorkbookWriter().write(book);
    expect(json[0].autofilter?.ref).toBe("A1:A3");
    const loaded = new WorkbookReader().read(json);
    expect(loaded.sheets[0].autoFilter.active()).toBe(true);
    expect(loaded.sheets[0].isRowHidden(2)).toBe(true);
    expect(loaded.sheets[0].isRowHidden(1)).toBe(false);
  });

  it("roundtrips table name and filters", () => {
    const book = Workbook.blank("销售表 2024");
    book.active().table = "销售表";
    book.active().filters = { 年份: 2024, 部门: "华东" };
    const json = new WorkbookWriter().write(book);
    expect(json[0].table).toBe("销售表");
    expect(json[0].filters).toEqual({ 年份: 2024, 部门: "华东" });
    const loaded = new WorkbookReader().read(json);
    expect(loaded.sheets[0].table).toBe("销售表");
    expect(loaded.sheets[0].filters).toEqual({ 年份: 2024, 部门: "华东" });
  });

  it("reads empty input as a blank book", () => {
    const loaded = new WorkbookReader().read(null);
    expect(loaded.sheets[0]).toBeInstanceOf(Sheet);
  });
});
