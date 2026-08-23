/**
 * Client for the French government's commune API (API Découpage administratif).
 * Free, keyless, and authoritative — it is the same INSEE dataset the cities
 * table was seeded from.
 *
 * Deliberately not `server-only`: the add-city form searches from the browser
 * for instant results, while the import action re-fetches by INSEE code on the
 * server so no field a client sent is ever trusted.
 *
 * https://geo.api.gouv.fr/decoupage-administratif/communes
 */

const BASE = "https://geo.api.gouv.fr/communes";
const FIELDS = "nom,code,codesPostaux,codeDepartement,departement,population,centre";

/** A commune normalised into the shape of the `cities` table. */
export type GouvCommune = {
  inseeCode: string;
  name: string;
  postalCode: string | null;
  /** Display form, matching existing rows: "Var · 83". */
  department: string | null;
  latitude: number | null;
  longitude: number | null;
  population: number | null;
};

type ApiCommune = {
  nom: string;
  code: string;
  codesPostaux?: string[];
  codeDepartement?: string;
  departement?: { code: string; nom: string };
  population?: number;
  centre?: { type: string; coordinates: [number, number] };
};

function normalise(c: ApiCommune): GouvCommune {
  // centre is GeoJSON: [longitude, latitude] — the reverse of how they are
  // stored, and silently wrong if swapped (communes land in the wrong country).
  const [longitude, latitude] = c.centre?.coordinates ?? [];

  const departement = c.departement
    ? `${c.departement.nom} · ${c.departement.code}`
    : (c.codeDepartement ?? null);

  return {
    inseeCode: c.code,
    name: c.nom,
    // A commune can have several postal codes; the first is the main one.
    postalCode: c.codesPostaux?.[0] ?? null,
    department: departement,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    population: c.population ?? null,
  };
}

/** INSEE codes are 5 characters; Corsica uses 2A / 2B in second position. */
export const INSEE_PATTERN = /^[0-9][0-9AB][0-9]{3}$/i;

/**
 * Search by name, postal code, or INSEE code. Five digits are treated as a
 * postal code (what an admin is most likely to type) and fall back to INSEE.
 */
export async function searchCommunes(query: string, limit = 10): Promise<GouvCommune[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({ fields: FIELDS, limit: String(limit) });
  if (/^\d{5}$/.test(q)) params.set("codePostal", q);
  else if (INSEE_PATTERN.test(q)) params.set("code", q.toUpperCase());
  else {
    params.set("nom", q);
    // Rank populous communes first; the fuzzy match alone buries them.
    params.set("boost", "population");
  }

  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`API géo indisponible (${res.status})`);

  const data: ApiCommune[] = await res.json();
  let results = data.map(normalise);

  // A five-digit query that matched no postal code may still be an INSEE code.
  if (results.length === 0 && /^\d{5}$/.test(q)) {
    const retry = new URLSearchParams({ fields: FIELDS, code: q });
    const res2 = await fetch(`${BASE}?${retry}`);
    if (res2.ok) results = ((await res2.json()) as ApiCommune[]).map(normalise);
  }

  return results;
}

/** Authoritative lookup used by the import action. */
export async function fetchCommuneByInsee(inseeCode: string): Promise<GouvCommune | null> {
  const params = new URLSearchParams({ fields: FIELDS });
  const res = await fetch(`${BASE}/${encodeURIComponent(inseeCode)}?${params}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API géo indisponible (${res.status})`);

  const data: ApiCommune | ApiCommune[] = await res.json();
  const commune = Array.isArray(data) ? data[0] : data;
  return commune?.code ? normalise(commune) : null;
}
