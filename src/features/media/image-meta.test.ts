import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { analyzeImage } from "./image-meta";

const solid = (width: number, height: number, rgb: [number, number, number]) =>
  sharp({ create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
    .png()
    .toBuffer();

describe("analyzeImage (real sharp)", () => {
  it("reads dimensions", async () => {
    const meta = await analyzeImage(await solid(320, 180, [10, 10, 10]));
    expect(meta.width).toBe(320);
    expect(meta.height).toBe(180);
  });

  it("produces a tiny webp blur placeholder", async () => {
    const meta = await analyzeImage(await solid(1600, 900, [10, 10, 10]));
    expect(meta.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    // ≤ 16px wide placeholder stays tiny regardless of source size
    expect(meta.blurDataUrl.length).toBeLessThan(400);
  });

  it("finds the dominant colour (cinema red)", async () => {
    const meta = await analyzeImage(await solid(64, 64, [193, 18, 31]));
    // sharp quantises the dominant colour into bins; it must land near #c1121f
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(meta.dominantColor.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(170);
    expect(g).toBeLessThan(40);
    expect(b).toBeLessThan(60);
  });
});
