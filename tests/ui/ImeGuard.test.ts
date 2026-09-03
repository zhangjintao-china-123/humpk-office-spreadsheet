import { describe, expect, it } from "vitest";
import { isCjk, isDirectLatinInput, isLatinKeyCode } from "../../src/ui/input/ImeGuard";

describe("ImeGuard", () => {
  it("detects CJK as first Chinese commit", () => {
    expect(isCjk("你")).toBe(true);
    expect(isCjk("你好abc")).toBe(true);
    expect(isCjk("nihao")).toBe(false);
    expect(isCjk("A1")).toBe(false);
  });

  it("does not treat composing pinyin as latin", () => {
    expect(isDirectLatinInput(true, "n")).toBe(false);
    expect(isDirectLatinInput(false, "n")).toBe(true);
    expect(isDirectLatinInput(false, "你")).toBe(false);
    expect(isDirectLatinInput(false, "")).toBe(false);
  });

  it("treats A-Z and digits as latin by keyCode, not IME 229", () => {
    expect(isLatinKeyCode(65, "a")).toBe(true);
    expect(isLatinKeyCode(48, "0")).toBe(true);
    expect(isLatinKeyCode(97, "1")).toBe(true);
    expect(isLatinKeyCode(187, "=")).toBe(true);
    expect(isLatinKeyCode(229, "n")).toBe(false);
    expect(isLatinKeyCode(229, "Process")).toBe(false);
  });
});
