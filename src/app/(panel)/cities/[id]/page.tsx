import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { when } from "@/lib/format";
import { fetchProfiles } from "@/lib/profiles";
import { ActionForm } from "@/components/ActionForm";
import { ImageUploadForm } from "@/components/ImageUploadForm";
import { setCityActive, uploadCityImage } from "@/actions/cities";

export const metadata = { title: "Commune — BTV Admin" };

type City = {
  id: string;
  name: string;
  insee_code: string;
  postal_code: string | null;
  department: string | null;
  population: number | null;
  member_count: number;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
};

export default async function CityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("manage_cities");
  const { id } = await params;

  const { data: city } = await db
    .from("cities")
    .select(
      "id, name, insee_code, postal_code, department, population, member_count, is_active, image_url, created_at",
    )
    .eq("id", id)
    .maybeSingle<City>();

  if (!city) notFound();

  const [{ count: publicationCount }, { data: recent }] = await Promise.all([
    db
      .from("publications")
      .select("*", { count: "exact", head: true })
      .eq("city_id", id)
      .is("hidden_at", null),
    db
      .from("publications")
      .select("id, text, author_id, created_at")
      .eq("city_id", id)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<{ id: string; text: string; author_id: string; created_at: string }[]>(),
  ]);

  // author_id references auth.users, not profiles — resolved separately.
  const authors = await fetchProfiles((recent ?? []).map((p) => p.author_id));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/cities" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        ← Communes
      </Link>

      <header className="mb-6 flex items-start gap-4">
        {city.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, optimisation disabled
          <img src={city.image_url} alt="" className="h-20 w-20 rounded-xl object-cover" />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-neutral-100" />
        )}

        <div>
          <h1 className="text-2xl font-semibold">{city.name}</h1>
          <p className="text-sm text-neutral-500">
            INSEE {city.insee_code} · {city.postal_code ?? "—"} · {city.department ?? "—"}
          </p>
          <p className="text-sm text-neutral-500">
            {city.population?.toLocaleString("fr-FR") ?? "?"} habitants · {city.member_count}{" "}
            membre(s) · {publicationCount ?? 0} publication(s)
          </p>
          {!city.is_active && (
            <span className="mt-2 inline-block rounded-md bg-neutral-200 px-2 py-0.5 text-xs font-medium">
              Fermée aux publications
            </span>
          )}
        </div>
      </header>

      <section className="mb-8 rounded-xl border border-neutral-200 p-5">
        <h2 className="mb-3 text-sm font-semibold">Image de la commune</h2>
        <ImageUploadForm action={uploadCityImage} fields={{ cityId: city.id }} />
      </section>

      <section className="mb-8 rounded-xl border border-neutral-200 p-5">
        <h2 className="mb-3 text-sm font-semibold">Statut</h2>
        <ActionForm
          action={setCityActive}
          label={city.is_active ? "Désactiver la commune" : "Activer la commune"}
          fields={{ cityId: city.id, active: String(!city.is_active) }}
          danger={city.is_active}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Publications récentes</h2>
        {(recent?.length ?? 0) === 0 ? (
          <p className="text-sm text-neutral-500">Aucune publication.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent?.map((publication) => (
              <li key={publication.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                <p className="mb-1 text-xs text-neutral-500">
                  @{authors[publication.author_id]?.username ?? "inconnu"} ·{" "}
                  {when(publication.created_at)}
                </p>
                <p className="line-clamp-2 whitespace-pre-wrap">{publication.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
