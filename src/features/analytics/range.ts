/** Dashboard date ranges (UTC days, inclusive), read from searchParams. Pure. */

export const PRESETS = ["7d", "30d", "90d"] as const;
export type Preset = (typeof PRESETS)[number] | "custom";

export type Range = {
  preset: Preset;
  /** Inclusive UTC day strings, YYYY-MM-DD */
  from: string;
  to: string;
  days: number;
  /** The equally long period right before, for deltas */
  previous: { from: string; to: string };
};

const DAY = 86_400_000;
const MAX_DAYS = 366;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const parse = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? Date.parse(`${s}T00:00:00Z`) : null);

export function resolveRange(params: { range?: string; from?: string; to?: string }, today: Date): Range {
  const todayT = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  let from: number;
  let to = todayT;
  let preset: Preset = "30d";

  const f = parse(params.from);
  const t = parse(params.to);
  if (params.range === "custom" && f !== null) {
    preset = "custom";
    to = Math.min(t ?? todayT, todayT);
    from = Math.max(Math.min(f, to), to - (MAX_DAYS - 1) * DAY);
  } else {
    preset = (PRESETS as readonly string[]).includes(params.range ?? "") ? (params.range as Preset) : "30d";
    from = to - (Number.parseInt(preset, 10) - 1) * DAY;
  }

  const days = Math.round((to - from) / DAY) + 1;
  return {
    preset,
    from: iso(from),
    to: iso(to),
    days,
    previous: { from: iso(from - days * DAY), to: iso(from - DAY) },
  };
}

/** Every day in [from, to] as YYYY-MM-DD. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end; t += DAY) out.push(iso(t));
  return out;
}

/** Relative change, or null when there's no baseline. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return (current - previous) / previous;
}
