import { describe, expect, it } from "vitest";
import { bumpDecimalPlaces, formatCellValue, formatPresetId } from "../../src/model/NumberFormat";

describe("NumberFormat", () => {
  it("general keeps numbers numeric and empty as empty", () => {
    expect(formatCellValue(20000)).toBe("20000");
    expect(formatCellValue(-549.98)).toBe("-549.98");
    expect(formatCellValue("")).toBe("");
  });

  it("number and comma formats keep decimals and grouping", () => {
    expect(formatCellValue(19450.02, "0.00")).toBe("19450.02");
    expect(formatCellValue(19450.02, "#,##0.00")).toBe("19,450.02");
    expect(formatCellValue(20000, "¥#,##0.00")).toBe("¥20,000.00");
  });

  it("percent multiplies by 100", () => {
    expect(formatCellValue(0.125, "0.00%")).toBe("12.50%");
  });

  it("dropdown presets map known codes", () => {
    expect(formatPresetId("General")).toBe("general");
    expect(formatPresetId("0.00%")).toBe("percent");
    expect(formatPresetId("¥#,##0.00")).toBe("currency");
    expect(formatPresetId("yyyy/m/d")).toBe("shortDate");
  });

  it("increase and decrease decimal places", () => {
    expect(bumpDecimalPlaces("General", 1)).toBe("0.0");
    expect(bumpDecimalPlaces("0.00", 1)).toBe("0.000");
    expect(bumpDecimalPlaces("0.00", -1)).toBe("0.0");
    expect(bumpDecimalPlaces("0.0%", -1)).toBe("0%");
    expect(bumpDecimalPlaces("#,##0.00", 1)).toBe("#,##0.000");
  });
});
