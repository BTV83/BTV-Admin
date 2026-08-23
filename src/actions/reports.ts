"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/types";

const schema = z.object({
  targetType: z.enum(["publication", "comment"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Closes every pending report on a target without touching the content: they
 * were reviewed and found not to warrant action.
 */
export async function dismissReports(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { admin } = await requireAdmin("moderate");

  const parsed = schema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { error: "Requête invalide." };

  const { targetType, targetId, reason } = parsed.data;

  const { data, error } = await db
    .from("reports")
    .update({
      status: "dismissed",
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      resolution_notes: reason ?? null,
    })
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: "report.dismiss",
    targetType,
    targetId,
    after: { dismissed: data?.length ?? 0 },
    reason,
  });

  revalidatePath("/moderation");
  revalidatePath("/");
  return { ok: `${data?.length ?? 0} signalement(s) rejeté(s).` };
}
