import { describe, expect, it } from "vitest";
import { imageRect, optionsFromRect, resizeRect } from "../../src/model/SheetImage";
import { SheetImages } from "../../src/model/SheetImages";

describe("SheetImages", () => {
  it("adds, updates and removes", () => {
    const images = new SheetImages();
    images.add({
      id: images.nextId(),
      url: "data:image/png;base64,xx",
      options: { left: 100, top: 80, width: 40, height: 20, scaleX: 2, scaleY: 2 },
    });
    expect(images.size()).toBe(1);
    expect(imageRect(images.list()[0])).toEqual({ x: 60, y: 60, width: 80, height: 40 });
    images.setOptions(0, { left: 50, top: 50, width: 40, height: 20, scaleX: 1, scaleY: 1 });
    expect(images.get(0)?.options.left).toBe(50);
    images.remove(0);
    expect(images.size()).toBe(0);
  });

  it("reads xlsheet uploadimages payload", () => {
    const images = new SheetImages();
    images.setData([
      { id: 3, url: "data:image/png;base64,aa", options: { left: 10, top: 20, width: 8, height: 8 } },
      { id: "bad" },
    ]);
    expect(images.size()).toBe(1);
    expect(images.get(3)?.options.scaleX).toBe(1);
  });

  it("resizes from the south-east handle", () => {
    const next = resizeRect({ x: 10, y: 10, width: 40, height: 20 }, "se", 10, 5, 16);
    expect(next).toEqual({ x: 10, y: 10, width: 50, height: 25 });
    const options = optionsFromRect(40, 20, next);
    expect(options.left).toBe(35);
    expect(options.scaleX).toBeCloseTo(1.25);
  });
});
