import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { day } from "@/lib/format";
import { sanitizeSearch } from "@/lib/search";
import { SearchBar } from "@/components/SearchBar";
import { Tabs } from "@/components/Tabs";

export const metadata = { title: "Utilisateurs — BTV Admin" };

const FILTERS = ["all", "banned", "suspended", "verified"] as const;
type Filter = (typeof FILTERS)[number];

type Row = {
  id: string;
  username: string;
  display_name: string | null;
  account_type: string;
  is_verified: boolean;
  follower_count: number;
  banned_at: string | null;
  suspended_until: string | null;
  created_at: string;
  city: { name: string } | null;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  await requireAdmin("manage_users");

  const { q: rawQuery, filter: rawFilter } = await searchParams;
  const q = sanitizeSearch(rawQuery);
  const filter: Filter = FILTERS.includes(rawFilter as Filter)
    ? (rawFilter as Filter)
    : "all";

  let query = db
    .from("profiles")
    .select(
      "id, username, display_name, account_type, is_verified, follower_count, banned_at, suspended_until, created_at, city:cities!home_city_id(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  if (filter === "banned") query = query.not("banned_at", "is", null);
  if (filter === "verified") query = query.eq("is_verified", true);
  if (filter === "suspended") query = query.gt("suspended_until", new Date().toISOString());

  const { data, error } = await query.returns<Row[]>();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Utilisateurs</h1>

      <SearchBar
        placeholder="Nom d’utilisateur ou nom affiché…"
        defaultValue={q}
        hidden={{ filter: filter === "all" ? undefined : filter }}
      />

      <Tabs
        current={filter}
        tabs={FILTERS.map((f) => ({
          key: f,
          href: `/users?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
          label: { all: "Tous", banned: "Bannis", suspended: "Suspendus", verified: "Certifiés" }[f],
        }))}
      />

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!error && (data?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          Aucun utilisateur.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Utilisateur</th>
                <th className="px-4 py-2 font-medium">Commune</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Abonnés</th>
                <th className="px-4 py-2 font-medium">Inscrit</th>
                <th className="px-4 py-2 font-medium">État</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((user) => (
                <tr key={user.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/users/${user.id}`} className="font-medium hover:underline">
                      @{user.username}
                    </Link>
                    {user.display_name && (
                      <span className="text-neutral-500"> · {user.display_name}</span>
                    )}
                    {user.is_verified && <span title="Certifié"> ✓</span>}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{user.city?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-600">{user.account_type}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{user.follower_count}</td>
                  <td className="px-4 py-2 text-neutral-600">{day(user.created_at)}</td>
                  <td className="px-4 py-2">
                    <Status banned={user.banned_at} suspended={user.suspended_until} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Status({ banned, suspended }: { banned: string | null; suspended: string | null }) {
  if (banned) {
    return (
      <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
        Banni
      </span>
    );
  }
  if (suspended && new Date(suspended) > new Date()) {
    return (
      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
        Suspendu
      </span>
    );
  }
  return <span className="text-xs text-neutral-400">Actif</span>;
}
