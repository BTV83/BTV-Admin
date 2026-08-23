import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sanitizeSearch } from "@/lib/search";
import { SearchBar } from "@/components/SearchBar";
import { Tabs } from "@/components/Tabs";
import { ActionForm } from "@/components/ActionForm";
import { setCityActive } from "@/actions/cities";
import { AddCityForm } from "./AddCityForm";

export const metadata = { title: "Communes — BTV Admin" };

const FILTERS = ["all", "active", "inactive"] as const;
type Filter = (typeof FILTERS)[number];

type City = {
  id: string;
  name: string;
  insee_code: string;
  department: string | null;
  population: number | null;
  member_count: number;
  is_active: boolean;
  image_url: string | null;
};

export default async function CitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  await requireAdmin("manage_cities");

  const sp = await searchParams;
  const q = sanitizeSearch(sp.q);
  const filter: Filter = FILTERS.includes(sp.filter as Filter)
    ? (sp.filter as Filter)
    : "all";

  let query = db
    .from("cities")
    .select("id, name, insee_code, department, population, member_count, is_active, image_url")
    .order("member_count", { ascending: false })
    .limit(100);

  if (q) query = query.ilike("name", `%${q}%`);
  if (filter === "active") query = query.eq("is_active", true);
  if (filter === "inactive") query = query.eq("is_active", false);

  const { data, error } = await query.returns<City[]>();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Communes</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Triées par nombre de membres. Les communes inactives sont fermées aux publications.
      </p>

      <AddCityForm />

      <SearchBar
        placeholder="Nom de commune…"
        defaultValue={q}
        hidden={{ filter: filter === "all" ? undefined : filter }}
      />

      <Tabs
        current={filter}
        tabs={FILTERS.map((f) => ({
          key: f,
          href: `/cities?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
          label: { all: "Toutes", active: "Actives", inactive: "Inactives" }[f],
        }))}
      />

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="flex flex-col gap-2">
        {data?.map((city) => (
          <div
            key={city.id}
            className="flex items-center gap-4 rounded-xl border border-neutral-200 p-3"
          >
            {city.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, optimisation disabled
              <img
                src={city.image_url}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="h-12 w-12 shrink-0 rounded-lg bg-neutral-100" />
            )}

            <div className="min-w-0 flex-1">
              <Link href={`/cities/${city.id}`} className="font-medium hover:underline">
                {city.name}
              </Link>
              <p className="text-xs text-neutral-500">
                {city.insee_code} · {city.department ?? "—"} ·{" "}
                {city.population?.toLocaleString("fr-FR") ?? "?"} hab. · {city.member_count}{" "}
                membre(s)
              </p>
            </div>

            {!city.is_active && (
              <span className="rounded-md bg-neutral-200 px-2 py-0.5 text-xs font-medium">
                Inactive
              </span>
            )}

            <ActionForm
              action={setCityActive}
              label={city.is_active ? "Désactiver" : "Activer"}
              fields={{ cityId: city.id, active: String(!city.is_active) }}
            />
          </div>
        ))}
      </div>

      {(data?.length ?? 0) === 0 && !error && (
        <p className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          Aucune commune.
        </p>
      )}
    </main>
  );
}
