import { REPORT_REASON, TARGET_TYPE } from "@/lib/labels";
import { when } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { dismissReports } from "@/actions/reports";
import { hideContent, unhideContent } from "@/actions/content";
import { banUser, unbanUser } from "@/actions/users";
import type { ProfileLite } from "@/lib/profiles";
import type { ReportGroup } from "./types";

// A server component on purpose: dates are formatted here, once, in the
// server's timezone. Formatting them in a client component would render
// differently on the server and in a browser on another timezone, which React
// reports as a hydration mismatch.

export function ReportGroupCard({
  group,
  author,
  reporters,
}: {
  group: ReportGroup;
  author?: ProfileLite;
  reporters: Record<string, ProfileLite>;
}) {
  const deleted = group.targetText === null && group.targetCreatedAt === null;
  const fields = { targetType: group.targetType, targetId: group.targetId };

  return (
    <article className="rounded-xl border border-neutral-200 p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium">
          {TARGET_TYPE[group.targetType]}
        </span>

        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          {group.reports.length} signalement{group.reports.length > 1 ? "s" : ""}
        </span>

        {group.targetHiddenAt && (
          <span className="rounded-md bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white">
            Masqué
          </span>
        )}

        {author?.banned_at && (
          <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
            Auteur banni
          </span>
        )}

        <span className="ml-auto text-xs text-neutral-500">
          {when(group.targetCreatedAt)}
        </span>
      </header>

      {deleted ? (
        <p className="mb-4 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500 italic">
          Le contenu signalé n’existe plus (supprimé par son auteur).
        </p>
      ) : (
        <blockquote className="mb-4 rounded-lg bg-neutral-50 p-3 text-sm whitespace-pre-wrap">
          {group.targetText || <span className="text-neutral-500 italic">(sans texte)</span>}
        </blockquote>
      )}

      {(group.photoUrls?.length || group.muxPlaybackId) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {group.photoUrls?.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element -- remote user media, optimisation disabled
            <img
              key={url}
              src={url}
              alt="Média signalé"
              className="h-24 w-24 rounded-lg border border-neutral-200 object-cover"
            />
          ))}
          {group.muxPlaybackId && (
            <a
              href={`https://stream.mux.com/${group.muxPlaybackId}.m3u8`}
              className="flex h-24 items-center rounded-lg border border-neutral-200 px-4 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Vidéo ↗
            </a>
          )}
        </div>
      )}

      <p className="mb-3 text-sm text-neutral-500">
        Auteur :{" "}
        {author ? (
          <span className="font-medium text-neutral-900">
            @{author.username}
            {author.display_name && ` (${author.display_name})`}
          </span>
        ) : (
          "inconnu"
        )}
      </p>

      <ul className="mb-4 flex flex-col gap-2 border-t border-neutral-100 pt-3">
        {group.reports.map((report) => (
          <li key={report.id} className="text-sm">
            <span className="font-medium">
              {REPORT_REASON[report.reason] ?? report.reason}
            </span>
            <span className="text-neutral-500">
              {" "}
              · @{reporters[report.reporter_id]?.username ?? "inconnu"} ·{" "}
              {when(report.created_at)}
            </span>
            {report.details && (
              <p className="mt-0.5 text-neutral-600">« {report.details} »</p>
            )}
          </li>
        ))}
      </ul>

      <footer className="flex flex-wrap items-start gap-2 border-t border-neutral-100 pt-4">
        <ActionForm action={dismissReports} label="Rejeter" fields={fields} />

        {!deleted &&
          (group.targetHiddenAt ? (
            <ActionForm action={unhideContent} label="Restaurer" fields={fields} />
          ) : (
            <ActionForm
              action={hideContent}
              label="Masquer"
              fields={fields}
              requiresReason
              danger
            />
          ))}

        {author &&
          (author.banned_at ? (
            <ActionForm
              action={unbanUser}
              label="Débannir l’auteur"
              fields={{ userId: author.id }}
            />
          ) : (
            <ActionForm
              action={banUser}
              label="Bannir l’auteur"
              fields={{ userId: author.id }}
              requiresReason
              danger
            />
          ))}
      </footer>
    </article>
  );
}
