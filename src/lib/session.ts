import "server-only";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { hashToken, newSessionToken } from "./crypto";
import { COOKIE } from "./cookie";
import type { Admin } from "./types";

export { COOKIE };

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // full session, absolute
const MFA_TTL_MS = 5 * 60 * 1000; // password step → TOTP step

export type SessionContext = { admin: Admin; mfaPending: boolean; sessionId: string };

export async function requestMeta() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return {
    // x-forwarded-for may be a chain; the client is the first entry.
    ip: fwd ? fwd.split(",")[0]!.trim() : null,
    userAgent: h.get("user-agent"),
  };
}

async function setCookie(token: string, maxAgeMs: number) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

/** Issued after a correct password. Authorises the TOTP form and nothing else. */
export async function createPendingSession(adminId: string): Promise<void> {
  const token = newSessionToken();
  const { ip, userAgent } = await requestMeta();

  const { error } = await db.from("admin_sessions").insert({
    admin_id: adminId,
    token_hash: hashToken(token),
    mfa_pending: true,
    expires_at: new Date(Date.now() + MFA_TTL_MS).toISOString(),
    ip,
    user_agent: userAgent,
  });
  if (error) throw new Error(`could not create session: ${error.message}`);

  await setCookie(token, MFA_TTL_MS);
}

/** Called once the TOTP code checks out: clears the flag and extends the expiry. */
export async function promoteSession(sessionId: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) throw new Error("no session cookie to promote");

  const { error } = await db
    .from("admin_sessions")
    .update({
      mfa_pending: false,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    })
    .eq("id", sessionId);
  if (error) throw new Error(`could not promote session: ${error.message}`);

  await setCookie(token, SESSION_TTL_MS);
}

/**
 * Resolves the cookie to an admin. Returns null for missing, expired, revoked
 * or disabled — so disabling an account kills its live sessions immediately.
 */
export async function getSession(): Promise<SessionContext | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await db
    .from("admin_sessions")
    .select(
      "id, mfa_pending, expires_at, revoked_at, admin:admin_users!inner(id, email, role, totp_enrolled_at, disabled_at)",
    )
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error || !data) return null;

  const admin = data.admin as unknown as Admin & { disabled_at: string | null };
  if (data.revoked_at) return null;
  if (new Date(data.expires_at) <= new Date()) return null;
  if (admin.disabled_at) return null;

  return {
    sessionId: data.id,
    mfaPending: data.mfa_pending,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      totp_enrolled_at: admin.totp_enrolled_at,
    },
  };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db
      .from("admin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashToken(token));
  }
  jar.delete(COOKIE);
}

/** Used when banning an admin or on password change. */
export async function revokeAllSessions(adminId: string): Promise<void> {
  await db
    .from("admin_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("admin_id", adminId)
    .is("revoked_at", null);
}
