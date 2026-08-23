"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/crypto";
import { revokeAllSessions } from "@/lib/session";
import type { ActionState } from "@/lib/types";

const ROLES = ["superadmin", "moderator", "support"] as const;

/**
 * Creates an admin with a generated temporary password, returned once in the
 * success message so it can be handed over out of band. The new admin enrols
 * their own authenticator on first login and cannot reach data before that.
 */
export async function createAdmin(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_team");

  const parsed = z
    .object({ email: z.string().email(), role: z.enum(ROLES) })
    .safeParse({ email: formData.get("email"), role: formData.get("role") });

  if (!parsed.success) return { error: "Email ou rôle invalide." };

  const email = parsed.data.email.toLowerCase();
  const tempPassword = randomBytes(12).toString("base64url");

  const { data, error } = await db
    .from("admin_users")
    .insert({
      email,
      password_hash: await hashPassword(tempPassword),
      role: parsed.data.role,
    })
    .select("id")
    .single();

  if (error) {
    return {
      error: error.code === "23505" ? `${email} existe déjà.` : error.message,
    };
  }

  await writeAudit({
    adminId: admin.id,
    action: "admin_user.create",
    targetType: "admin_user",
    targetId: data.id,
    after: { email, role: parsed.data.role },
  });

  revalidatePath("/team");
  return { ok: `${email} créé. Mot de passe temporaire : ${tempPassword}` };
}

export async function setAdminRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_team");

  const parsed = z
    .object({ adminId: z.string().uuid(), role: z.enum(ROLES) })
    .safeParse({ adminId: formData.get("adminId"), role: formData.get("role") });

  if (!parsed.success) return { error: "Requête invalide." };

  // Losing the last superadmin would leave nobody able to manage the team.
  if (parsed.data.adminId === admin.id && parsed.data.role !== "superadmin") {
    return { error: "Vous ne pouvez pas retirer votre propre rôle superadmin." };
  }

  const { data: before } = await db
    .from("admin_users")
    .select("id, email, role")
    .eq("id", parsed.data.adminId)
    .maybeSingle();

  if (!before) return { error: "Administrateur introuvable." };

  const { error } = await db
    .from("admin_users")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.adminId);

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: "admin_user.set_role",
    targetType: "admin_user",
    targetId: parsed.data.adminId,
    before,
    after: { role: parsed.data.role },
  });

  revalidatePath("/team");
  return { ok: `${before.email} est désormais ${parsed.data.role}.` };
}

/** Disabling revokes live sessions too — getSession() rejects a disabled admin. */
export async function setAdminDisabled(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_team");

  const parsed = z
    .object({ adminId: z.string().uuid(), disabled: z.enum(["true", "false"]) })
    .safeParse({
      adminId: formData.get("adminId"),
      disabled: formData.get("disabled"),
    });

  if (!parsed.success) return { error: "Requête invalide." };

  if (parsed.data.adminId === admin.id) {
    return { error: "Vous ne pouvez pas désactiver votre propre compte." };
  }

  const disabled = parsed.data.disabled === "true";

  const { data: before } = await db
    .from("admin_users")
    .select("id, email, disabled_at")
    .eq("id", parsed.data.adminId)
    .maybeSingle();

  if (!before) return { error: "Administrateur introuvable." };

  const disabledAt = disabled ? new Date().toISOString() : null;
  const { error } = await db
    .from("admin_users")
    .update({ disabled_at: disabledAt })
    .eq("id", parsed.data.adminId);

  if (error) return { error: error.message };

  if (disabled) await revokeAllSessions(parsed.data.adminId);

  await writeAudit({
    adminId: admin.id,
    action: disabled ? "admin_user.disable" : "admin_user.enable",
    targetType: "admin_user",
    targetId: parsed.data.adminId,
    before,
    after: { disabled_at: disabledAt },
  });

  revalidatePath("/team");
  return { ok: disabled ? `${before.email} désactivé.` : `${before.email} réactivé.` };
}

/** Forces re-enrolment, for a lost or compromised authenticator. */
export async function resetAdminTotp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_team");

  const adminId = z.string().uuid().safeParse(formData.get("adminId"));
  if (!adminId.success) return { error: "Requête invalide." };

  const { data: before } = await db
    .from("admin_users")
    .select("id, email, totp_enrolled_at")
    .eq("id", adminId.data)
    .maybeSingle();

  if (!before) return { error: "Administrateur introuvable." };

  const { error } = await db
    .from("admin_users")
    .update({ totp_secret: null, totp_enrolled_at: null })
    .eq("id", adminId.data);

  if (error) return { error: error.message };

  await revokeAllSessions(adminId.data);

  await writeAudit({
    adminId: admin.id,
    action: "admin_user.reset_totp",
    targetType: "admin_user",
    targetId: adminId.data,
    before,
    after: { totp_enrolled_at: null },
  });

  revalidatePath("/team");
  return { ok: `${before.email} devra reconfigurer son authentificateur.` };
}
