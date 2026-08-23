import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { when } from "@/lib/format";
import { sanitizeSearch } from "@/lib/search";
import { fetchProfiles } from "@/lib/profiles";
import { PUBLICATION_TYPE } from "@/lib/labels";
import { SearchBar } from "@/components/SearchBar";
import { Tabs } from "@/components/Tabs";
import { ActionForm } from "@/components/ActionForm";
import { hideContent, unhideContent } from "@/actions/content";

export const metadata = { title: "Contenus — BTV Admin" };

type Kind = "publications" | "comments";

type Row = {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  hidden_at: string | null;
  hidden_reason: string | null;
  type?: string;
  like_count?: number;
  comment_count?: number;
  city?: { name: string } | null;
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; hidden?: string; type?: string }>;
}) {
  await requireAdmin("moderate");

  const sp = await searchParams;
  const q = sanitizeSearch(sp.q);
  const kind: Kind = sp.kind === "comments" ? "comments" : "publications";
  const hiddenOnly = sp.hidden === "1";

  // No author embed: author_id points at auth.users, not profiles, so there is
  // no relationship for PostgREST to follow. Authors are resolved below.
  const select =
    kind === "publications"
      ? "id, text, author_id, created_at, hidden_at, hidden_reason, type, like_count, comment_count, city:cities!city_id(name)"
      : "id, text, author_id, created_at, hidden_at, hidden_reason";

  let query = db
    .from(kind)
    .select(select)
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) query = query.ilike("text", `%${q}%`);
  if (hiddenOnly) query = query.not("hidden_at", "is", null);
  if (kind === "publications" && sp.type) query = query.eq("type", sp.type);

  const { data, error } = await query.returns<Row[]>();
  const authors = await fetchProfiles((data ?? []).map((row) => row.author_id));

  const base = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ kind, q, hidden: hiddenOnly ? "1" : undefined, ...params })) {
      if (value) search.set(key, value);
    }
    return `/content?${search.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Contenus</h1>

      <SearchBar
        placeholder="Rechercher dans le texte…"
        defaultValue={q}
        hidden={{ kind, hidden: hiddenOnly ? "1" : undefined }}
      />

      <Tabs
        current={kind}
        tabs={[
          { key: "publications", href: base({ kind: "publications", type: undefined }), label: "Publications" },
          { key: "comments", href: base({ kind: "comments", type: undefined }), label: "Commentaires" },
        ]}
      />

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link
          href={base({ hidden: hiddenOnly ? undefined : "1" })}
          className={`rounded-lg border px-3 py-1 ${
            hiddenOnly ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"
          }`}
        >
          Masqués uniquement
        </Link>

        {kind === "publications" &&
          Object.entries(PUBLICATION_TYPE).map(([value, label]) => (
            <Link
              key={value}
              href={base({ type: sp.type === value ? undefined : value })}
              className={`rounded-lg border px-3 py-1 ${
                sp.type === value
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300"
              }`}
            >
              {label}
            </Link>
          ))}
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!error && (data?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          Aucun contenu.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data?.map((row) => (
            <article key={row.id} className="rounded-xl border border-neutral-200 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                {authors[row.author_id] ? (
                  <Link href={`/users/${row.author_id}`} className="font-medium hover:underline">
                    @{authors[row.author_id]!.username}
                  </Link>
                ) : (
                  <span>auteur inconnu</span>
                )}
                <span>· {when(row.created_at)}</span>
                {row.city && <span>· {row.city.name}</span>}
                {row.type && <span>· {PUBLICATION_TYPE[row.type] ?? row.type}</span>}
                {typeof row.like_count === "number" && (
                  <span>· {row.like_count} ❤ {row.comment_count} 💬</span>
                )}
                {row.hidden_at && (
                  <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-white">
                    Masqué
                  </span>
                )}
              </div>

              <p className="mb-3 whitespace-pre-wrap text-sm">{row.text}</p>

              {row.hidden_reason && (
                <p className="mb-3 text-xs text-neutral-500">Motif : {row.hidden_reason}</p>
              )}

              {row.hidden_at ? (
                <ActionForm
                  action={unhideContent}
                  label="Restaurer"
                  fields={{
                    targetType: kind === "publications" ? "publication" : "comment",
                    targetId: row.id,
                  }}
                />
              ) : (
                <ActionForm
                  action={hideContent}
                  label="Masquer"
                  fields={{
                    targetType: kind === "publications" ? "publication" : "comment",
                    targetId: row.id,
                  }}
                  requiresReason
                  danger
                />
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
