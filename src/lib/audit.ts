import "server-only";
import { db } from "./db";
import { requestMeta } from "./session";

type AuditEntry = {
  adminId: string;
  action: string; // 'publication.hide', 'profile.ban', …
  targetType?: "publication" | "comment" | "profile" | "city" | "report" | "admin_user";
  targetId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

/**
 * Records a privileged write. The table rejects UPDATE and DELETE by trigger,
 * so entries cannot be edited away afterwards — not even with the service_role
 * key this app holds.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { ip } = await requestMeta();

  const { error } = await db.from("admin_audit_log").insert({
    admin_id: entry.adminId,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
    ip,
  });

  // An unrecorded privileged action is worse than a failed one: surface it.
  if (error) throw new Error(`audit write failed for ${entry.action}: ${error.message}`);
}
