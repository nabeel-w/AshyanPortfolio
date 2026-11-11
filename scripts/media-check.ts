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
  const noImporter = [...used].filter((id) => !providers.find((p) => p.id === id)?.importer);
  if (noImporter.length) console.log(dim(`  (no server imports for: ${noImporter.join(", ")})\n`));

  await checkGoogle({ ok, bad, dim });
  process.exitCode = failures ? 1 : 0;
}

/** Google (optional): Drive imports + Gmail notifications. docs/03 "Import sources". */
async function checkGoogle({ ok, bad, dim }: Record<"ok" | "bad" | "dim", (s: string) => string>) {
  console.log("Google (Drive import · Gmail notifications):");
  const vars = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "NEXT_PUBLIC_GOOGLE_PICKER_API_KEY",
    "NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER",
  ];
  const missing = vars.filter((v) => !process.env[v]);
  if (missing.length === vars.length) {
    console.log(
      dim("  not configured (optional). Setup: docs/03-asset-storage.md → Import sources\n"),
    );
    return;
  }
  if (missing.length) console.log(`  ${bad("✗")} missing: ${missing.join(", ")}`);

  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (id && secret) {
    // An invalid code against valid credentials says "invalid_grant"; bad credentials say "invalid_client".
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: id,
        client_secret: secret,
        grant_type: "authorization_code",
        code: "media-check",
        redirect_uri: `${process.env.BETTER_AUTH_URL}/api/auth/callback/google`,
      }),
    }).catch(() => null);
    const error = res
      ? ((await res.json().catch(() => ({}))) as { error?: string }).error
      : "network error";
    if (error === "invalid_grant") console.log(`  ${ok("✓")} OAuth client     credentials valid`);
    else
      console.log(
        `  ${bad("✗")} OAuth client     ${error ?? "unexpected response"} (check GOOGLE_CLIENT_ID / SECRET)`,
      );
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
  if (key) {
    // The Picker key is referrer-restricted and only checked inside the Picker, so a format check is what we can do here.
    const looksRight = /^AIza[0-9A-Za-z_-]{35}$/.test(key);
    console.log(
      `  ${looksRight ? ok("✓") : bad("✗")} Picker API key   ${looksRight ? "format OK (Google checks it when the Picker opens)" : "doesn't look like a Google API key"}`,
    );
  }
  const project = process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER;
  if (project) {
    const numeric = /^\d{6,}$/.test(project);
    console.log(
      `  ${numeric ? ok("✓") : bad("✗")} Project number   ${numeric ? project : "must be the numeric project number, not the project id"}`,
    );
  }

  try {
    const { db } = await import("../src/lib/db");
    const { hasFeature } = await import("../src/features/google/scopes");
    const { emailFromIdToken } = await import("../src/features/google/accounts");
    const linked = await db.account.findMany({
      where: { providerId: "google" },
      select: { scope: true, idToken: true },
    });
    if (!linked.length)
      console.log(dim("  no Google account linked yet (Admin → Settings → Connected services)"));
    for (const a of linked) {
      const features = [
        hasFeature(a.scope, "drive") && "Drive",
        hasFeature(a.scope, "gmail") && "Gmail",
      ]
        .filter(Boolean)
        .join(" + ");
      console.log(
        `  ${ok("✓")} linked           ${emailFromIdToken(a.idToken) ?? "account"} → ${features || "no feature scopes"}`,
      );
    }
  } catch (e) {
    console.log(dim(`  (couldn't read linked accounts: ${(e as Error).message.slice(0, 120)})`));
  }
  console.log("");
}

void main();
