/**
 * Creates the first admin account. There is no signup route in the panel —
 * this script and the (future) superadmin invite flow are the only ways in.
 *
 *   npm run admin:create
 *
 * Deliberately shares no code with src/lib: those modules import "server-only",
 * which throws outside a React Server Component context.
 *
 * The account is created without a second factor; enrolment happens on the
 * first login, and until it completes the account cannot reach any data.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { hash } from "@node-rs/argon2";

const ROLES = ["superadmin", "moderator", "support"] as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Did you create .env.local from .env.example?`);
    process.exit(1);
  }
  return value;
}

/** readline echoes input; mask it so the password does not end up on screen. */
async function askHidden(rl: ReturnType<typeof createInterface>, prompt: string) {
  const output = stdout as NodeJS.WriteStream & { muted?: boolean };
  const originalWrite = output.write.bind(output);

  output.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    if (output.muted && typeof chunk === "string" && !chunk.includes("\n")) return true;
    return (originalWrite as (...a: unknown[]) => boolean)(chunk, ...args);
  }) as typeof output.write;

  const promise = rl.question(prompt);
  output.muted = true;
  try {
    return await promise;
  } finally {
    output.muted = false;
    output.write = originalWrite;
    originalWrite("\n");
  }
}

async function main() {
  const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const email = (await rl.question("Email: ")).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email.");

    const password = await askHidden(rl, "Password (min 12 chars): ");
    if (password.length < 12) throw new Error("Password must be at least 12 characters.");

    const confirm = await askHidden(rl, "Confirm password: ");
    if (password !== confirm) throw new Error("Passwords do not match.");

    const roleInput = (await rl.question(`Role [${ROLES.join("/")}] (superadmin): `)).trim();
    const role = (roleInput || "superadmin") as (typeof ROLES)[number];
    if (!ROLES.includes(role)) throw new Error(`Role must be one of ${ROLES.join(", ")}.`);

    const { data, error } = await db
      .from("admin_users")
      .insert({ email, password_hash: await hash(password), role })
      .select("id")
      .single();

    if (error) {
      // 23505 = unique violation on lower(email)
      throw new Error(
        error.code === "23505" ? `An admin with ${email} already exists.` : error.message,
      );
    }

    console.log(`\n✓ Created ${role} ${email} (${data.id})`);
    console.log("  Two-factor enrolment happens on first login.");
  } catch (err) {
    console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

void main();
