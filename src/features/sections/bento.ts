/**
 * Bento tile shapes for the work grid (#29). Pure, so the server grid, tests and the admin hint agree.
 *
 *   feature  2 col × 2 row on desktop (2 × 1 below)   first featured landscape film
 *   wide     2 × 1                                     landscape long-form
 *   tall     1 × 2                                     portrait reel / Short (9:16)
 *   square   1 × 1                                     square edits
 *
 * Rows are sized from the column width (globals.css .bento) so a tall tile is exactly 9:16.
 */

export type Tile = "feature" | "wide" | "tall" | "square";
export type CardSizeSetting = "auto" | Tile;

export type TileInput = {
  orientation?: "landscape" | "portrait" | "square";
  cardSize?: CardSizeSetting;
  featured?: boolean;
};

/**
 * A project's tile: the admin's cardSize override first, then its orientation (portrait → tall,
 * square → square), then the first featured landscape film becomes the feature, everything else wide.
 */
export function tileFor(p: TileInput, opts: { featureTaken: boolean }): Tile {
  if (p.cardSize && p.cardSize !== "auto") return p.cardSize;
  if (p.orientation === "portrait") return "tall";
  if (p.orientation === "square") return "square";
  if (p.featured && !opts.featureTaken) return "feature";
  return "wide";
}

/** Tiles for a whole list in grid order: at most one automatic feature (an explicit FEATURE always wins). */
export function tilesFor(projects: TileInput[]): Tile[] {
  let featureTaken = false;
  return projects.map((p) => {
    const tile = tileFor(p, { featureTaken });
    if (tile === "feature" && (!p.cardSize || p.cardSize === "auto")) featureTaken = true;
    return tile;
  });
}

/** Grid classes per tile (2 columns below lg, 4 from lg). */
export const tileClass: Record<Tile, string> = {
  feature: "col-span-2 lg:row-span-2",
  wide: "col-span-2",
  tall: "row-span-2",
  square: "",
};

/** next/image `sizes` per tile. */
export const tileSizes: Record<Tile, string> = {
  feature: "(min-width: 1024px) 50vw, 100vw",
  wide: "(min-width: 1024px) 50vw, 100vw",
  tall: "(min-width: 1024px) 25vw, 50vw",
  square: "(min-width: 1024px) 25vw, 50vw",
};

/** Serif title size scales with the tile. */
export const tileTitle: Record<Tile, string> = {
  feature: "text-3xl md:text-5xl",
  wide: "text-2xl md:text-4xl",
  tall: "text-xl md:text-3xl",
  square: "text-xl md:text-2xl",
};
