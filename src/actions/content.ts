"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/types";

const target = z.object({
  targetType: z.enum(["publication", "comment"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

function parseTarget(formData: FormData) {
  return target.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason") || undefined,
  });
}

/** Both tables carry the same moderation columns. */
function tableFor(targetType: "publication" | "comment") {
  return targetType === "publication" ? "publications" : "comments";
}

function revalidateAll() {
  revalidatePath("/moderation");
  revalidatePath("/content");
  revalidatePath("/");
}

/**
 * Soft-hides content: it disappears from the app (the RLS read policies require
 * hidden_at is null) while the row and its evidence survive for review.
 */
export async function hideContent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { admin } = await requireAdmin("moderate");
  const parsed = parseTarget(formData);
  if (!parsed.success) return { error: "Requête invalide." };

  const { targetType, targetId, reason } = parsed.data;
  if (!reason) return { error: "Un motif est requis pour masquer un contenu." };

  const table = tableFor(targetType);

  const { data: before } = await db
    .from(table)
    .select("id, hidden_at, hidden_reason")
    .eq("id", targetId)
    .maybeSingle();

  if (!before) return { error: "Contenu introuvable (déjà supprimé ?)." };
  if (before.hidden_at) return { error: "Ce contenu est déjà masqué." };

  const hiddenAt = new Date().toISOString();
  const { error } = await db
    .from(table)
    .update({ hidden_at: hiddenAt, hidden_by: admin.id, hidden_reason: reason })
    .eq("id", targetId);

  if (error) return { error: error.message };

  // Any pending report on this target is now resolved by the same decision.
  await db
    .from("reports")
    .update({
      status: "actioned",
      reviewed_by: admin.id,
      reviewed_at: hiddenAt,
      resolution_notes: reason,
    })
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "pending");

  await writeAudit({
    adminId: admin.id,
    action: `${targetType}.hide`,
    targetType,
    targetId,
    before,
    after: { hidden_at: hiddenAt, hidden_reason: reason },
    reason,
  });

  revalidateAll();
  return { ok: "Contenu masqué." };
}

/** Reverses hideContent. Existing reports keep whatever status they had. */
export async function unhideContent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { admin } = await requireAdmin("moderate");
  const parsed = parseTarget(formData);
  if (!parsed.success) return { error: "Requête invalide." };

  const { targetType, targetId, reason } = parsed.data;
  const table = tableFor(targetType);

  const { data: before } = await db
    .from(table)
    .select("id, hidden_at, hidden_reason")
    .eq("id", targetId)
    .maybeSingle();

  if (!before) return { error: "Contenu introuvable." };

  const { error } = await db
    .from(table)
    .update({ hidden_at: null, hidden_by: null, hidden_reason: null })
    .eq("id", targetId);

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: `${targetType}.unhide`,
    targetType,
    targetId,
    before,
    after: { hidden_at: null },
    reason,
  });

  revalidateAll();
  return { ok: "Contenu restauré." };
}
