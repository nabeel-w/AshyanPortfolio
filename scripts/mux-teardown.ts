/**
 * pnpm media:mux-teardown [--yes]
 *
 * One-off for #27: stop paying Mux. Lists every asset in the Mux environment (MUX_TOKEN_ID /
 * MUX_TOKEN_SECRET from .env.local) next to the Asset rows that point at it, then — only with --yes —
 * deletes them at Mux and removes the matching rows.
 *
 * Refuses to delete while anything public still depends on Mux: a published project without a
 * YouTube film, or any project whose hover loop is still a Mux asset (run pnpm media:loops-to-blob).
 * Run it after the v2 release is live, then remove MUX_* from Vercel and delete the Mux webhook.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

type MuxAsset = {
  id: string;
  status: string;
  duration?: number;
  aspect_ratio?: string;
  created_at: string;
  playback_ids?: { id: string; policy: string }[];
  passthrough?: string;
};

const API = "https://api.mux.com/video/v1/assets";

function authHeader() {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) throw new Error("Set MUX_TOKEN_ID and MUX_TOKEN_SECRET (Mux → Settings → Access tokens).");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function listAll(): Promise<MuxAsset[]> {
  const out: MuxAsset[] = [];
  for (let page = 1; page < 100; page++) {
    const res = await fetch(`${API}?limit=100&page=${page}`, { headers: { Authorization: authHeader() } });
    if (!res.ok) throw new Error(`Mux list failed: ${res.status} ${await res.text()}`);
    const { data } = (await res.json()) as { data: MuxAsset[] };
    out.push(...data);
    if (data.length < 100) break;
  }
  return out;
}

async function main() {
  const yes = process.argv.includes("--yes");
  const { db } = await import("../src/lib/db");

  const [assets, rows, projects] = await Promise.all([
    listAll(),
    db.asset.findMany({ where: { provider: "mux" } }),
    db.project.findMany({ select: { slug: true, status: true, filmYoutubeId: true, loop: { select: { provider: true } } } }),
  ]);

  const rowFor = (a: MuxAsset) =>
    rows.find((r) => r.providerKey === a.id || (r.meta as { assetId?: string } | null)?.assetId === a.id);
  console.log(`Mux assets: ${assets.length} · Asset rows with provider "mux": ${rows.length}\n`);
  for (const a of assets) {
    const row = rowFor(a);
    console.log(
      [
        a.id.padEnd(46),
        a.status.padEnd(9),
        `${(a.duration ?? 0).toFixed(1)}s`.padStart(7),
        (a.aspect_ratio ?? "").padEnd(6),
        a.created_at ? new Date(Number(a.created_at) * 1000).toISOString().slice(0, 10) : "",
        row ? `row ${row.id} (${row.filename})` : "no row",
      ].join("  "),
    );
  }

  const blockers = [
    ...projects.filter((p) => p.status === "PUBLISHED" && !p.filmYoutubeId).map((p) => `${p.slug}: published without a YouTube film`),
    ...projects.filter((p) => p.loop?.provider === "mux").map((p) => `${p.slug}: hover loop still on Mux (pnpm media:loops-to-blob --yes)`),
  ];
  if (blockers.length) {
    console.log(`\nNot safe to delete yet:\n${blockers.map((b) => `  - ${b}`).join("\n")}`);
    if (yes) process.exitCode = 1;
    await db.$disconnect();
    return;
  }
  if (!yes) {
    console.log("\nDry run. Nothing public uses Mux any more; re-run with --yes to delete everything above.");
    await db.$disconnect();
    return;
  }

  for (const a of assets) {
    const res = await fetch(`${API}/${a.id}`, { method: "DELETE", headers: { Authorization: authHeader() } });
    console.log(`${res.ok || res.status === 404 ? "✓" : "✗"} delete ${a.id} (${res.status})`);
  }
  const { count } = await db.asset.deleteMany({ where: { provider: "mux" } });
  console.log(`Removed ${count} Asset rows. Next: delete the Mux webhook, then \`vercel env rm\` MUX_* everywhere.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
