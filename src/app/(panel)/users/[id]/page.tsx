import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { when } from "@/lib/format";
import { can } from "@/lib/types";
import { REPORT_REASON, REPORT_STATUS } from "@/lib/labels";
import { ActionForm } from "@/components/ActionForm";
import { SelectForm } from "@/components/SelectForm";
import {
  banUser,
  deleteUser,
  liftSuspension,
  setAccountType,
  setVerified,
  suspendUser,
  unbanUser,
} from "@/actions/users";
import { hideContent, unhideContent } from "@/actions/content";

export const metadata = { title: "Profil — BTV Admin" };

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  account_type: string;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  banned_at: string | null;
  ban_reason: string | null;
  suspended_until: string | null;
  created_at: string;
  city: { name: string } | null;
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { admin } = await requireAdmin("manage_users");
  const { id } = await params;

  const { data: profile } = await db
    .from("profiles")
    .select(
      "id, username, display_name, bio, account_type, is_verified, follower_count, following_count, banned_at, ban_reason, suspended_until, created_at, city:cities!home_city_id(name)",
    )
    .eq("id", id)
    .maybeSingle<Profile>();

  if (!profile) notFound();

  const [{ data: publications }, { data: reports }] = await Promise.all([
    db
      .from("publications")
      .select("id, text, type, created_at, hidden_at, like_count, comment_count")
      .eq("author_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    // report_queue exposes target_author_id, which is what makes "reports
    // against this person" a single query rather than one per publication.
    db
      .from("report_queue")
      .select("id, reason, status, created_at, target_type, target_id")
      .eq("target_author_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const suspended =
    profile.suspended_until && new Date(profile.suspended_until) > new Date();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/users" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        ← Utilisateurs
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          @{profile.username}
          {profile.is_verified && <span title="Certifié"> ✓</span>}
        </h1>
        <p className="text-sm text-neutral-500">
          {profile.display_name ?? "—"} · {profile.city?.name ?? "sans commune"} ·{" "}
          {profile.follower_count} abonnés · inscrit le {when(profile.created_at)}
        </p>
        {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {profile.banned_at && (
            <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
              Banni le {when(profile.banned_at)}
              {profile.ban_reason && ` — ${profile.ban_reason}`}
            </span>
          )}
          {suspended && (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              Suspendu jusqu’au {when(profile.suspended_until)}
            </span>
          )}
        </div>
      </header>

      <section className="mb-8 rounded-xl border border-neutral-200 p-5">
        <h2 className="mb-4 text-sm font-semibold">Actions</h2>

        <div className="mb-4 flex flex-wrap gap-6">
          <SelectForm
            action={setAccountType}
            label="Type de compte"
            name="accountType"
            value={profile.account_type}
            fields={{ userId: profile.id }}
            options={[
              { value: "citizen", label: "Citoyen" },
              { value: "official", label: "Officiel" },
              { value: "association", label: "Association" },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <ActionForm
            action={setVerified}
            label={profile.is_verified ? "Retirer la certification" : "Certifier"}
            fields={{ userId: profile.id, verified: String(!profile.is_verified) }}
          />

          {suspended ? (
            <ActionForm
              action={liftSuspension}
              label="Lever la suspension"
              fields={{ userId: profile.id }}
            />
          ) : (
            <ActionForm
              action={suspendUser}
              label="Suspendre 7 jours"
              fields={{ userId: profile.id, days: "7" }}
              requiresReason
            />
          )}

          {profile.banned_at ? (
            <ActionForm action={unbanUser} label="Débannir" fields={{ userId: profile.id }} />
          ) : (
            <ActionForm
              action={banUser}
              label="Bannir"
              fields={{ userId: profile.id }}
              requiresReason
              danger
            />
          )}

          {can(admin.role, "delete_users") && (
            <ActionForm
              action={deleteUser}
              label="Supprimer le compte (RGPD)"
              fields={{ userId: profile.id }}
              requiresReason
              confirmField={{
                name: "confirm",
                placeholder: `Tapez « ${profile.username} » pour confirmer`,
              }}
              danger
            />
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">
          Publications ({publications?.length ?? 0})
        </h2>
        {(publications?.length ?? 0) === 0 ? (
          <p className="text-sm text-neutral-500">Aucune publication.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {publications?.map((publication) => (
              <li
                key={publication.id}
                className="rounded-lg border border-neutral-200 p-3 text-sm"
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
                  <span>{when(publication.created_at)}</span>
                  <span>· {publication.type}</span>
                  <span>· {publication.like_count} ❤ {publication.comment_count} 💬</span>
                  {publication.hidden_at && (
                    <span className="rounded bg-neutral-900 px-1.5 text-white">Masqué</span>
                  )}
                </div>
                <p className="mb-2 line-clamp-3 whitespace-pre-wrap">{publication.text}</p>
                {publication.hidden_at ? (
                  <ActionForm
                    action={unhideContent}
                    label="Restaurer"
                    fields={{ targetType: "publication", targetId: publication.id }}
                  />
                ) : (
                  <ActionForm
                    action={hideContent}
                    label="Masquer"
                    fields={{ targetType: "publication", targetId: publication.id }}
                    requiresReason
                    danger
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Signalements reçus ({reports?.length ?? 0})
        </h2>
        {(reports?.length ?? 0) === 0 ? (
          <p className="text-sm text-neutral-500">Aucun signalement.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {reports?.map((report) => (
              <li key={report.id} className="text-neutral-600">
                {when(report.created_at)} · {REPORT_REASON[report.reason] ?? report.reason} ·{" "}
                {REPORT_STATUS[report.status] ?? report.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
