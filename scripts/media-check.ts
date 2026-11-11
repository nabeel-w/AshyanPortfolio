/**
 * pnpm media:check — shows which storage provider handles each media type, what env is missing,
 * and pings each configured provider to prove the credentials work.
 * Runs with `--conditions=react-server` so server-only modules can be imported.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { providers, providerIdFor, missingEnv } = await import("../src/features/media/providers");
  const kinds = ["VIDEO", "IMAGE", "AUDIO", "DOCUMENT"] as const;

  const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
  const ok = (s: string) => `\x1b[32m${s}\x1b[0m`;
  const bad = (s: string) => `\x1b[31m${s}\x1b[0m`;

  console.log("\nRouting (MEDIA_*_PROVIDER):");
  const used = new Set<string>();
  for (const kind of kinds) {
    try {
      const id = providerIdFor(kind);
      used.add(id);
      console.log(`  ${kind.padEnd(9)} → ${id}`);
    } catch (e) {
      console.log(`  ${kind.padEnd(9)} → ${bad((e as Error).message)}`);
    }
  }

  console.log("\nProviders:");
  let failures = 0;
  for (const p of providers) {
    const missing = missingEnv(p);
    const inUse = used.has(p.id);
    const tag = inUse ? "[in use]" : dim("[available]");
    if (missing.length) {
      if (inUse) failures++;
      console.log(
        `  ${(inUse ? bad : dim)("✗")} ${p.id.padEnd(18)} ${tag} missing: ${missing.join(", ")}`,
      );
      if (inUse) console.log(`      ${dim(p.setup)}`);
      continue;
    }
    if (!p.check) {
      console.log(`  ${ok("✓")} ${p.id.padEnd(18)} ${tag} configured`);
      continue;
    }
    try {
      console.log(`  ${ok("✓")} ${p.id.padEnd(18)} ${tag} ${await p.check()}`);
    } catch (e) {
      if (inUse) failures++;
      console.log(`  ${bad("✗")} ${p.id.padEnd(18)} ${tag} ${(e as Error).message.slice(0, 200)}`);
    }
  }

  console.log(
    failures
      ? bad(`\n${failures} provider(s) in use need attention.\n`)
      : ok("\nStorage is ready.\n"),
  );
  process.exit(failures ? 1 : 0);
}

void main();
