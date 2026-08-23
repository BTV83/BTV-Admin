"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/types";

const PROFILE_FIELDS = "id, username, banned_at, ban_reason, suspended_until, is_verified, account_type";

function revalidateUser(userId: string) {
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
  revalidatePath("/moderation");
  revalidatePath("/");
}

async function loadProfile(userId: string) {
  const { data } = await db.from("profiles").select(PROFILE_FIELDS).eq("id", userId).maybeSingle();
  return data;
}

const sanction = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

/**
 * Bans an account. Enforcement lives in the database: the publications and
 * comments INSERT policies call is_sanctioned(), so this bites even while the
 * user still holds a valid Supabase session on their device.
 */
export async function banUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_users");

  const parsed = sanction.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: "Un motif est requis pour bannir." };

  const before = await loadProfile(parsed.data.userId);
  if (!before) return { error: "Profil introuvable." };
  if (before.banned_at) return { error: "Ce compte est déjà banni." };

  const bannedAt = new Date().toISOString();
  const { error } = await db
    .from("profiles")
    .update({ banned_at: bannedAt, ban_reason: parsed.data.reason })
    .eq("id", parsed.data.userId);

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: "profile.ban",
    targetType: "profile",
    targetId: parsed.data.userId,
    before,
    after: { banned_at: bannedAt, ban_reason: parsed.data.reason },
    reason: parsed.data.reason,
  });

  revalidateUser(parsed.data.userId);
  return { ok: `@${before.username} a été banni.` };
}

export async function unbanUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_users");

  const userId = z.string().uuid().safeParse(formData.get("userId"));
  if (!userId.success) return { error: "Requête invalide." };

  const before = await loadProfile(userId.data);
  if (!before) return { error: "Profil introuvable." };

  const { error } = await db
    .from("profiles")
    .update({ banned_at: null, ban_reason: null })
    .eq("id", userId.data);

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: "profile.unban",
    targetType: "profile",
    targetId: userId.data,
    before,
    after: { banned_at: null },
  });

  revalidateUser(userId.data);
  return { ok: `@${before.username} a été débanni.` };
}

/** Temporary mute. is_sanctioned() treats suspended_until > now() like a ban. */
export async function suspendUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_users");

  const parsed = z
    .object({
      userId: z.string().uuid(),
      days: z.coerce.number().int().min(1).max(365),
      reason: z.string().trim().min(1).max(500),
    })
    .safeParse({
      userId: formData.get("userId"),
      days: formData.get("days"),
      reason: formData.get("reason"),
    });

  if (!parsed.success) return { error: "Durée (1-365 jours) et motif requis." };

  const before = await loadProfile(parsed.data.userId);
  if (!before) return { error: "Profil introuvable." };

  const until = new Date(Date.now() + parsed.data.days * 86_400_000).toISOString();
  const { error } = await db
    .from("profiles")
    .update({ suspended_until: until, ban_reason: parsed.data.reason })
    .eq("id", parsed.data.userId);

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: "profile.suspend",
    targetType: "profile",
    targetId: parsed.data.userId,
    before,
    after: { suspended_until: until },
    reason: parsed.data.reason,
  });

  revalidateUser(parsed.data.userId);
  return { ok: `@${before.username} suspendu ${parsed.data.days} jour(s).` };
}

export async function liftSuspension(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_users");

  const userId = z.string().uuid().safeParse(formData.get("userId"));
  if (!userId.success) return { error: "Requête invalide." };

  const before = await loadProfile(userId.data);
  if (!before) return { error: "Profil introuvable." };

  const { error } = await db
    .from("profiles")
    .update({ suspended_until: null })
    .eq("id", userId.data);

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: "profile.unsuspend",
    targetType: "profile",
    targetId: userId.data,
    before,
    after: { suspended_until: null },
  });

  revalidateUser(userId.data);
  return { ok: "Suspension levée." };
}

/** The blue-check equivalent: profiles.is_verified. */
export async function setVerified(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_users");

  const parsed = z
    .object({ userId: z.string().uuid(), verified: z.enum(["true", "false"]) })
    .safeParse({ userId: formData.get("userId"), verified: formData.get("verified") });

  if (!parsed.success) return { error: "Requête invalide." };

  const verified = parsed.data.verified === "true";
  const before = await loadProfile(parsed.data.userId);
  if (!before) return { error: "Profil introuvable." };

  const { error } = await db
    .from("profiles")
    .update({ is_verified: verified })
    .eq("id", parsed.data.userId);

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: verified ? "profile.verify" : "profile.unverify",
    targetType: "profile",
    targetId: parsed.data.userId,
    before,
    after: { is_verified: verified },
  });

  revalidateUser(parsed.data.userId);
  return { ok: verified ? "Compte certifié." : "Certification retirée." };
}

export async function setAccountType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_users");

  const parsed = z
    .object({
      userId: z.string().uuid(),
      accountType: z.enum(["citizen", "official", "association"]),
    })
    .safeParse({
      userId: formData.get("userId"),
      accountType: formData.get("accountType"),
    });

  if (!parsed.success) return { error: "Type de compte invalide." };

  const before = await loadProfile(parsed.data.userId);
  if (!before) return { error: "Profil introuvable." };

  const { error } = await db
    .from("profiles")
    .update({ account_type: parsed.data.accountType })
    .eq("id", parsed.data.userId);

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: "profile.set_account_type",
    targetType: "profile",
    targetId: parsed.data.userId,
    before,
    after: { account_type: parsed.data.accountType },
  });

  revalidateUser(parsed.data.userId);
  return { ok: `Type de compte : ${parsed.data.accountType}.` };
}

/**
 * GDPR erasure. Deletes the auth user; profiles.id references auth.users with
 * ON DELETE CASCADE, so the profile, publications, comments and likes go with
 * it. Irreversible, and therefore superadmin-only.
 */
export async function deleteUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin("delete_users");

  const parsed = z
    .object({
      userId: z.string().uuid(),
      reason: z.string().trim().min(1).max(500),
      confirm: z.string(),
    })
    .safeParse({
      userId: formData.get("userId"),
      reason: formData.get("reason"),
      confirm: formData.get("confirm"),
    });

  if (!parsed.success) return { error: "Motif requis." };

  const before = await loadProfile(parsed.data.userId);
  if (!before) return { error: "Profil introuvable." };

  // Typing the username is the last guard before an irreversible cascade.
  if (parsed.data.confirm.trim() !== before.username) {
    return { error: `Saisissez « ${before.username} » pour confirmer.` };
  }

  // Audit BEFORE deleting: afterwards there is nothing left to describe.
  await writeAudit({
    adminId: admin.id,
    action: "profile.delete",
    targetType: "profile",
    targetId: parsed.data.userId,
    before,
    reason: parsed.data.reason,
  });

  const { error } = await db.auth.admin.deleteUser(parsed.data.userId);
  if (error) return { error: error.message };

  revalidateUser(parsed.data.userId);
  return { ok: `@${before.username} supprimé définitivement.` };
}
