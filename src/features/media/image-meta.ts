import sharp from "sharp";

/**
 * Dimensions + a tiny blurred placeholder + dominant colour, so images paint instantly with
 * zero layout shift (next/image placeholder="blur", background colour while loading).
 */
export async function analyzeImage(input: Buffer) {
  const image = sharp(input, { failOn: "none" });
  const meta = await image.metadata();
  const [blur, stats] = await Promise.all([
    image.clone().resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer(),
    image.clone().stats(),
  ]);
  const { r, g, b } = stats.dominant;
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return {
    width: meta.autoOrient?.width ?? meta.width,
    height: meta.autoOrient?.height ?? meta.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    dominantColor: `#${hex(r)}${hex(g)}${hex(b)}`,
  };
}
