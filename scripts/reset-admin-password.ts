/**
 * Break-glass password reset for an existing admin. The panel has no "forgot
 * password" flow by design — there is no email sender, and a self-service reset
 * route would be the weakest link in an account that can read every user's data.
 *
 *   npm run admin:reset
 *
 * Optionally clears the second factor too, for the case where the authenticator
 * itself is gone (new phone, wiped app). Enrolment then happens again on the
 * next login, exactly as for a fresh account.
 *
 * Deliberately shares no code with src/lib: those modules import "server-only",
 * which throws outside a React Server Component context.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { hash } from "@node-rs/argon2";

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
    const { data: admins, error: listError } = await db
      .from("admin_users")
      .select("id, email, role, totp_enrolled_at, disabled_at")
      .order("created_at");

    if (listError) throw new Error(listError.message);
    if (!admins?.length) {
      throw new Error("No admin accounts exist. Run `npm run admin:create` instead.");
    }

    console.log("\nExisting admins:");
    for (const a of admins) {
      const flags = [
        a.role,
        a.totp_enrolled_at ? "2FA enrolled" : "2FA pending",
        a.disabled_at ? "disabled" : null,
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`  • ${a.email} (${flags})`);
    }
    console.log("");

    const email = (await rl.question("Email to reset: ")).trim().toLowerCase();
    const admin = admins.find((a) => a.email.toLowerCase() === email);
    if (!admin) throw new Error(`No admin with ${email}.`);

    const password = await askHidden(rl, "New password (min 12 chars): ");
    if (password.length < 12) throw new Error("Password must be at least 12 characters.");

    const confirm = await askHidden(rl, "Confirm password: ");
    if (password !== confirm) throw new Error("Passwords do not match.");

    // Only worth clearing if the authenticator is also lost — otherwise the
    // existing enrolment keeps working and re-enrolling is pointless friction.
    const resetTotp = admin.totp_enrolled_at
      ? (await rl.question("Also reset two-factor (lost authenticator)? [y/N]: "))
          .trim()
          .toLowerCase() === "y"
      : false;

    const patch: Record<string, unknown> = { password_hash: await hash(password) };
    if (resetTotp) {
      patch.totp_secret = null;
      patch.totp_enrolled_at = null;
    }

    const { error } = await db.from("admin_users").update(patch).eq("id", admin.id);
    if (error) throw new Error(error.message);

    // The panel records every privileged write; a break-glass reset performed
    // outside it should not be the one action that leaves no trace.
    await db.from("admin_audit_log").insert({
      admin_id: admin.id,
      action: resetTotp ? "admin.password_and_totp_reset" : "admin.password_reset",
      target_type: "admin_user",
      target_id: admin.id,
      reason: "CLI break-glass reset (scripts/reset-admin-password.ts)",
    });

    console.log(`\n✓ Password updated for ${admin.email}`);
    if (resetTotp) console.log("  Two-factor cleared — enrolment happens on next login.");
  } catch (err) {
    console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

void main();
