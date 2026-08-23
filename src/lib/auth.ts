import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getSession, type SessionContext } from "./session";
import { can, type Permission } from "./types";

/**
 * THE authorisation boundary. Every page, layout and server action that touches
 * data must call this first.
 *
 * Middleware deliberately does not do this job. Next.js has had a run of
 * middleware/proxy bypass advisories, so middleware here only handles the
 * cosmetic redirect; a bypass of it still hits this check and gets nothing.
 */
export async function requireAdmin(permission?: Permission): Promise<SessionContext> {
  const session = await getSession();

  if (!session) redirect("/login");
  if (session.mfaPending) {
    // An admin created by the CLI has no authenticator yet; enrolment is the
    // second factor on that first login.
    redirect(session.admin.totp_enrolled_at ? "/login/verify" : "/login/enroll");
  }

  if (permission && !can(session.admin.role, permission)) {
    // Distinct from "not logged in": the identity is known and insufficient.
    redirect("/denied");
  }

  return session;
}

/**
 * Guard for the login sub-pages (/login/verify, /login/enroll), which are the
 * only places a half-authenticated session is allowed to go.
 */
export async function requirePendingSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.mfaPending) redirect("/");
  return session;
}

// ---------------------------------------------------------------------------
// Login rate limiting, backed by admin_login_attempts.
// ---------------------------------------------------------------------------
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  successful: boolean,
): Promise<void> {
  await db.from("admin_login_attempts").insert({
    email: email.toLowerCase(),
    ip,
    successful,
  });
}

/** True when the caller should be turned away before any password check. */
export async function isRateLimited(email: string, ip: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const byEmail = await db
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email", email.toLowerCase())
    .eq("successful", false)
    .gte("created_at", since);

  if ((byEmail.count ?? 0) >= MAX_PER_EMAIL) return true;

  if (ip) {
    const byIp = await db
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("successful", false)
      .gte("created_at", since);

    if ((byIp.count ?? 0) >= MAX_PER_IP) return true;
  }

  return false;
}
