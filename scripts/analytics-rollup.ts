/**
 * pnpm analytics:rollup [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 * Runs the nightly analytics rollup by hand. With no flags it does what the cron does (missing days
 * up to yesterday + retention). With --from/--to it backfills (re-rolls) that range of UTC days.
 * Runs with `--conditions=react-server` so server-only modules can be imported.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

function flag(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`--${name} must be YYYY-MM-DD`);
  return v ? new Date(`${v}T00:00:00Z`) : undefined;
}

async function main() {
  const { runRollups } = await import("../src/features/analytics/rollup");
  const from = flag("from");
  const to = flag("to");
  const result = await runRollups(new Date(), { from, to });
  for (const d of result.days) console.log(`  ${d.day}  ${d.pages} page rows · ${d.dims} breakdown rows`);
  console.log(`Rolled up ${result.days.length} day(s); pruned ${result.pruned} raw event(s) past retention.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
