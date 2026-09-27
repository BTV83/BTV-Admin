import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MeteoPicker, type MeteoCity } from "./MeteoPicker";

export const metadata = { title: "Météo — BTV Admin" };

export default async function MeteoPage() {
  await requireAdmin();

  // Cities are read on the server with the service client, so no Supabase key
  // or NEXT_PUBLIC_ variable is ever needed in the browser.
  const { data, error } = await db
    .from("cities")
    .select("id, name, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("name")
    .returns<MeteoCity[]>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Météo</h1>
      {error ? (
        <p className="text-sm text-red-600">Impossible de charger les communes.</p>
      ) : (
        <MeteoPicker cities={data ?? []} />
      )}
    </div>
  );
}
