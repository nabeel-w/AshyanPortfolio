/**
 * pnpm media:loops-to-blob [--yes]
 *
 * One-off for the Mux → Blob move (#26, #27): copies every project's hover loop that still lives on Mux
 * to the video provider (Vercel Blob), with its width/height/duration, and points the project at the
 * copy. The Mux rows stay until `pnpm media:mux-teardown` removes them. Dry run without --yes.
 * Needs ffprobe on PATH for the loop's size (optional: without it the loop just has no dimensions).
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

/** Mux stored the playback id in the HLS / thumbnail URLs; read it from there, not a column. */
export function muxPlaybackId(asset: { url: string | null; meta: unknown }): string | null {
  const meta = (asset.meta ?? {}) as { hls?: unknown };
  for (const u of [typeof meta.hls === "string" ? meta.hls : null, asset.url]) {
    const m = u ? /^https:\/\/(?:stream|image)\.mux\.com\/([A-Za-z0-9]+)/.exec(u) : null;
    if (m) return m[1]!;
  }
  return null;
}

async function probe(file: Buffer) {
  const dir = await mkdtemp(path.join(tmpdir(), "loop-"));
  const p = path.join(dir, "loop.mp4");
  try {
    await writeFile(p, file);
    const { stdout } = await promisify(execFile)("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height:format=duration", "-of", "json", p,
    ]);
    const j = JSON.parse(stdout) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
    return { width: j.streams?.[0]?.width, height: j.streams?.[0]?.height, duration: Number(j.format?.duration) || undefined };
  } catch {
    return {};
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const yes = process.argv.includes("--yes");
  const { db } = await import("../src/lib/db");
  const media = await import("../src/features/media/service");

  const projects = await db.project.findMany({
    where: { loop: { provider: "mux" } },
    include: { loop: true },
    orderBy: { order: "asc" },
  });
  if (!projects.length) console.log("No project has a Mux hover loop. Nothing to do.");

  for (const p of projects) {
    const loop = p.loop!;
    const pid = muxPlaybackId(loop);
    const src = pid ? `https://stream.mux.com/${pid}/highest.mp4` : null;
    console.log(`${p.slug.padEnd(24)} ${loop.filename} ← ${src ?? "(no playback id: skipped)"}`);
    if (!src || !yes) continue;
    const res = await fetch(src);
    if (!res.ok) {
      console.warn(`  ✗ download failed: ${res.status}`);
      continue;
    }
    const file = Buffer.from(await res.arrayBuffer());
    const shape = await probe(file);
    const filename = loop.filename.replace(/\.[a-z0-9]+$/i, "") + ".mp4";
    const asset = await media.ingest(file, {
      filename,
      mimeType: "video/mp4",
      alt: loop.alt,
      purpose: "loop",
      probe: shape,
    });
    await db.project.update({ where: { id: p.id }, data: { loopId: asset.id } });
    console.log(`  ✓ ${asset.provider} ${asset.status} ${shape.width ?? "?"}×${shape.height ?? "?"} ${(file.length / 1024 / 1024).toFixed(1)} MB → ${asset.url}`);
  }
  if (!yes && projects.length) console.log("\nDry run. Re-run with --yes to copy.");
  await db.$disconnect();
}

if (process.argv[1]?.includes("loops-to-blob")) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
