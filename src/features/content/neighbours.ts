/**
 * Pure helpers over the grid-ordered work list, shared by project pages and tests (#28, #30).
 * The list is always the public grid order (featured first, then the admin order).
 */

type Item = { slug: string; labels: { slug: string }[] };

/** Previous and next film in grid order, wrapping around. None when the film is alone (or unknown). */
export function neighbours<T extends Item>(list: T[], slug: string): { prev?: T; next?: T } {
  const i = list.findIndex((p) => p.slug === slug);
  if (i < 0 || list.length < 2) return {};
  const next = list[(i + 1) % list.length];
  const prev = list[(i - 1 + list.length) % list.length];
  // With two films, prev and next are the same one: show it once, as next.
  return list.length === 2 ? { next } : { prev, next };
}

/**
 * Up to `n` other films for "More in <label>": those sharing the primary label first, then any shared
 * label, then the rest of the list (latest in grid order), never the film itself and never twice.
 */
export function relatedWork<T extends Item>(list: T[], slug: string, labelSlugs: string[], n = 3): T[] {
  const others = list.filter((p) => p.slug !== slug);
  const [primary, ...rest] = labelSlugs;
  const has = (p: T, s?: string) => !!s && p.labels.some((l) => l.slug === s);
  const picked: T[] = [];
  const add = (items: T[]) => {
    for (const p of items) if (picked.length < n && !picked.includes(p)) picked.push(p);
  };
  add(others.filter((p) => has(p, primary)));
  add(others.filter((p) => rest.some((s) => has(p, s))));
  add(others);
  return picked;
}
