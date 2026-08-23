"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { isRateLimited, recordLoginAttempt, requirePendingSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  createPendingSession,
  destroySession,
  promoteSession,
  requestMeta,
} from "@/lib/session";
import { decryptSecret, encryptSecret, verifyPassword, wasteTime } from "@/lib/crypto";
import { checkTotp, newTotpSecret } from "@/lib/totp";

export type FormState = { error?: string };

// One message for every failure mode below, so the form cannot be used to
// discover which emails have admin accounts.
const GENERIC = "Identifiants invalides.";

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC };

  const email = parsed.data.email.toLowerCase();
  const { ip } = await requestMeta();

  if (await isRateLimited(email, ip)) {
    return { error: "Trop de tentatives. Réessayez dans 15 minutes." };
  }

  const { data: admin } = await db
    .from("admin_users")
    .select("id, password_hash, disabled_at, totp_enrolled_at")
    .eq("email", email)
    .maybeSingle();

  if (!admin || admin.disabled_at) {
    // Spend the same time as a real verification would.
    await wasteTime(parsed.data.password);
    await recordLoginAttempt(email, ip, false);
    return { error: GENERIC };
  }

  if (!(await verifyPassword(admin.password_hash, parsed.data.password))) {
    await recordLoginAttempt(email, ip, false);
    return { error: GENERIC };
  }

  // Password is correct, but this is only half of the login: the session issued
  // here can reach the TOTP form and nothing else.
  await recordLoginAttempt(email, ip, true);
  await createPendingSession(admin.id);

  redirect(admin.totp_enrolled_at ? "/login/verify" : "/login/enroll");
}

const code = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function verifyTotpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requirePendingSession();

  const parsed = code.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Code à 6 chiffres attendu." };

  const { data: admin } = await db
    .from("admin_users")
    .select("totp_secret")
    .eq("id", session.admin.id)
    .maybeSingle();

  if (!admin?.totp_secret) return { error: GENERIC };

  if (!(await checkTotp(parsed.data.code, decryptSecret(admin.totp_secret)))) {
    const { ip } = await requestMeta();
    await recordLoginAttempt(session.admin.email, ip, false);
    return { error: "Code incorrect." };
  }

  await promoteSession(session.sessionId);
  await db
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", session.admin.id);

  await writeAudit({
    adminId: session.admin.id,
    action: "admin.login",
    targetType: "admin_user",
    targetId: session.admin.id,
  });

  redirect("/");
}

/**
 * Returns the secret to display as a QR code. totp_enrolled_at stays null until
 * a live code confirms it.
 *
 * An unconfirmed secret is reused rather than regenerated, so that reloading the
 * page does not invalidate an authenticator entry the user has already scanned.
 */
export async function beginEnrollment(adminId: string): Promise<string> {
  const { data: existing } = await db
    .from("admin_users")
    .select("totp_secret, totp_enrolled_at")
    .eq("id", adminId)
    .maybeSingle();

  if (existing?.totp_secret && !existing.totp_enrolled_at) {
    return decryptSecret(existing.totp_secret);
  }

  const secret = newTotpSecret();
  const { error } = await db
    .from("admin_users")
    .update({ totp_secret: encryptSecret(secret), totp_enrolled_at: null })
    .eq("id", adminId);
  if (error) throw new Error(error.message);
  return secret;
}

export async function confirmEnrollmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requirePendingSession();

  const parsed = code.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Code à 6 chiffres attendu." };

  const { data: admin } = await db
    .from("admin_users")
    .select("totp_secret")
    .eq("id", session.admin.id)
    .maybeSingle();

  if (!admin?.totp_secret) return { error: "Aucune inscription en cours." };

  // Confirming with a live code proves the authenticator was actually added,
  // rather than locking the account behind a secret nobody holds.
  if (!(await checkTotp(parsed.data.code, decryptSecret(admin.totp_secret)))) {
    return { error: "Code incorrect." };
  }

  const now = new Date().toISOString();
  await db
    .from("admin_users")
    .update({ totp_enrolled_at: now, last_login_at: now })
    .eq("id", session.admin.id);

  await promoteSession(session.sessionId);
  await writeAudit({
    adminId: session.admin.id,
    action: "admin.totp_enrolled",
    targetType: "admin_user",
    targetId: session.admin.id,
  });

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
