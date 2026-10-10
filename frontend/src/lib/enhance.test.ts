import { describe, expect, it } from "vitest";
import { enhanceForOcr } from "./enhance";

// A grey image as RGBA pixels, built from a function of the position.
function image(width: number, height: number, value: (x: number, y: number) => number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = value(x, y);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

describe("enhanceForOcr", () => {
  const width = 400;
  const height = 300;
  // Paper that gets darker from left to right (a shadow), with a thin dark stroke of "text"
  // that is equally faint relative to the paper everywhere.
  const paper = (x: number) => 220 - (x / width) * 120;
  const isText = (x: number, y: number) => y >= 148 && y <= 152 && x % 40 < 20;
  const source = image(width, height, (x, y) => (isText(x, y) ? paper(x) * 0.4 : paper(x)));
  const result = enhanceForOcr(source, width, height);
  const at = (x: number, y: number) => result[(y * width + x) * 4];

  it("turns unevenly lit paper into a uniform light background", () => {
    const left = at(50, 60);
    const right = at(350, 60);

    expect(Math.abs(left - right)).toBeLessThan(12);
    expect(left).toBeGreaterThan(200);
    // Before, the shadow made the right side much darker than the left.
    expect(source[(60 * width + 50) * 4] - source[(60 * width + 350) * 4]).toBeGreaterThan(80);
  });

  it("keeps text dark in the light and in the shadow", () => {
    expect(at(50, 150)).toBeLessThan(100);
    expect(at(330, 150)).toBeLessThan(100);
  });

  it("returns opaque grey pixels of the same size", () => {
    expect(result.length).toBe(source.length);
    expect(result[0]).toBe(result[1]);
    expect(result[1]).toBe(result[2]);
    expect(result[3]).toBe(255);
  });
});
