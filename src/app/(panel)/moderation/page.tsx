import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchProfiles } from "@/lib/profiles";
import { ReportGroupCard } from "./ReportGroupCard";
import type { ReportGroup, ReportRow } from "./types";

export const metadata = { title: "Modération — BTV Admin" };

const STATUSES = ["pending", "actioned", "dismissed"] as const;
type Status = (typeof STATUSES)[number];

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("moderate");

  const { status: raw } = await searchParams;
  const status: Status = STATUSES.includes(raw as Status) ? (raw as Status) : "pending";

  const { data: reports, error } = await db
    .from("report_queue")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ReportRow[]>();

  if (error) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="mb-4 text-2xl font-semibold">Modération</h1>
        <p className="text-sm text-red-600">
          Impossible de charger la file : {error.message}
        </p>
      </main>
    );
  }

  const groups = groupByTarget(reports ?? []);
  const profiles = await fetchProfiles(profileIds(groups));

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Modération</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {groups.length} contenu(s) · {reports?.length ?? 0} signalement(s)
      </p>

      <nav className="mb-8 flex gap-1">
        {STATUSES.map((s) => (
          <a
            key={s}
            href={`/moderation?status=${s}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              s === status
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {{ pending: "En attente", actioned: "Traités", dismissed: "Rejetés" }[s]}
          </a>
        ))}
      </nav>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          Aucun signalement dans cette file.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <ReportGroupCard
              key={`${group.targetType}:${group.targetId}`}
              group={group}
              author={group.targetAuthorId ? profiles[group.targetAuthorId] : undefined}
              reporters={profiles}
            />
          ))}
        </div>
      )}
    </main>
  );
}

/**
 * Several users often report the same post. Grouping means a moderator makes
 * one decision per piece of content rather than one per report.
 */
function groupByTarget(rows: ReportRow[]): ReportGroup[] {
  const map = new Map<string, ReportGroup>();

  for (const row of rows) {
    const key = `${row.target_type}:${row.target_id}`;
    const existing = map.get(key);

    if (existing) {
      existing.reports.push(row);
      continue;
    }

    map.set(key, {
      targetType: row.target_type,
      targetId: row.target_id,
      targetText: row.target_text,
      targetAuthorId: row.target_author_id,
      targetHiddenAt: row.target_hidden_at,
      targetCreatedAt: row.target_created_at,
      photoUrls: row.photo_urls,
      muxPlaybackId: row.mux_playback_id,
      reports: [row],
    });
  }

  return [...map.values()].sort((a, b) => b.reports.length - a.reports.length);
}

/** Every author and reporter across the queue, resolved in one query. */
function profileIds(groups: ReportGroup[]): string[] {
  return groups.flatMap((group) => [
    group.targetAuthorId,
    ...group.reports.map((report) => report.reporter_id),
  ]).filter((id): id is string => !!id);
}
