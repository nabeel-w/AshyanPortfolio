/**
 * Create (or reset the password of) an admin account without exposing the password in shell history.
 *
 *   pnpm admin:create <email> "<Full Name>"
 *
 * The email must be listed in ADMIN_EMAILS. The password is read from a hidden prompt,
 * or from ADMIN_PASSWORD for non-interactive use (CI / provisioning).
 * Writes the same rows Better Auth's email+password sign-up would (user + "credential" account).
 */
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: [".env.local", ".env"], quiet: true });

const MIN_PASSWORD = 12; // keep in sync with src/lib/auth.ts

async function promptHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write(question);
  muted = true;
  const answer = await new Promise<string>((resolve) => rl.question("", resolve));
  rl.close();
  process.stdout.write("\n");
  return answer;
}

async function main() {
  const [emailArg, ...nameParts] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const name = nameParts.join(" ").trim() || "Admin";
  if (!email) throw new Error('Usage: pnpm admin:create <email> "<Full Name>"');

  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(email)) throw new Error(`${email} is not in ADMIN_EMAILS — add it to .env.local first.`);

  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden("Password (12+ chars): "));
  if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const hash = await hashPassword(password);
    const user = await db.user.upsert({
      where: { email },
      update: { name, role: "ADMIN" },
      create: { id: randomUUID(), email, name, role: "ADMIN", emailVerified: true },
    });
    const existing = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
    if (existing) {
      await db.account.update({ where: { id: existing.id }, data: { password: hash } });
      // Sign out everywhere after a password reset.
      await db.session.deleteMany({ where: { userId: user.id } });
      console.log(`Updated password for ${email} and revoked existing sessions.`);
    } else {
      await db.account.create({
        data: { id: randomUUID(), userId: user.id, accountId: user.id, providerId: "credential", password: hash },
      });
      console.log(`Created admin ${email}. Sign in at /login.`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
