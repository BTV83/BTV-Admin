import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/types";

export const metadata = { title: "Tableau de bord — BTV Admin" };

export default async function DashboardPage() {
  const { admin } = await requireAdmin();

  // head + exact count returns only the number, never the rows.
  const [pending, users, publications, hidden] = await Promise.all([
    db.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("profiles").select("*", { count: "exact", head: true }),
    db.from("publications").select("*", { count: "exact", head: true }).is("hidden_at", null),
    db.from("publications").select("*", { count: "exact", head: true }).not("hidden_at", "is", null),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold">Tableau de bord</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Signalements en attente"
          value={pending.count}
          href={can(admin.role, "moderate") ? "/moderation" : undefined}
        />
        <Stat label="Utilisateurs" value={users.count} />
        <Stat label="Publications visibles" value={publications.count} />
        <Stat label="Contenus masqués" value={hidden.count} />
      </div>

      {!can(admin.role, "moderate") && (
        <p className="mt-8 text-sm text-neutral-500">Votre rôle est en lecture seule.</p>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number | null;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-3xl font-semibold tabular-nums">{value ?? "—"}</div>
      <div className="mt-1 text-sm text-neutral-500">{label}</div>
    </>
  );

  return href ? (
    <Link
      href={href}
      className="rounded-xl border border-neutral-200 p-5 transition hover:border-neutral-400"
    >
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-neutral-200 p-5">{body}</div>
  );
}
