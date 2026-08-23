import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { when } from "@/lib/format";

export const metadata = { title: "Journal d’audit — BTV Admin" };

type Entry = {
  id: number;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  ip: string | null;
  created_at: string;
  before: unknown;
  after: unknown;
  admin: { email: string } | null;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  await requireAdmin("view_audit");

  const { action } = await searchParams;

  let query = db
    .from("admin_audit_log")
    .select(
      "id, action, target_type, target_id, reason, ip, created_at, before, after, admin:admin_users!admin_id(email)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (action) query = query.eq("action", action);

  const { data, error } = await query.returns<Entry[]>();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Journal d’audit</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Append-only : un trigger en base refuse toute modification ou suppression, y
        compris via la clé service_role utilisée par ce panneau.
      </p>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {(data?.length ?? 0) === 0 && !error ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          Aucune entrée pour l’instant.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {data?.map((entry) => (
            <details key={entry.id} className="rounded-xl border border-neutral-200 p-4">
              <summary className="cursor-pointer text-sm">
                <span className="font-medium">{entry.action}</span>
                <span className="text-neutral-500">
                  {" "}
                  · {entry.admin?.email ?? "compte supprimé"} · {when(entry.created_at)}
                </span>
                {entry.reason && (
                  <span className="text-neutral-600"> — « {entry.reason} »</span>
                )}
              </summary>

              <dl className="mt-3 grid gap-2 text-xs">
                <Row label="Cible">
                  {entry.target_type ?? "—"} {entry.target_id ?? ""}
                </Row>
                <Row label="IP">{entry.ip ?? "—"}</Row>
                {entry.before != null && (
                  <Row label="Avant">
                    <pre className="overflow-x-auto rounded bg-neutral-50 p-2">
                      {JSON.stringify(entry.before, null, 2)}
                    </pre>
                  </Row>
                )}
                {entry.after != null && (
                  <Row label="Après">
                    <pre className="overflow-x-auto rounded bg-neutral-50 p-2">
                      {JSON.stringify(entry.after, null, 2)}
                    </pre>
                  </Row>
                )}
              </dl>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-neutral-500">{label}</dt>
      <dd className="text-neutral-800">{children}</dd>
    </div>
  );
}
