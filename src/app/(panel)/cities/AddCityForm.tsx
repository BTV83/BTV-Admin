"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { importCity } from "@/actions/cities";
import { searchCommunes, type GouvCommune } from "@/lib/geoApi";
import type { ActionState } from "@/lib/types";

const initial: ActionState = {};
const MIN_QUERY = 2;

export function AddCityForm() {
  const [state, formAction, pending] = useActionState(importCity, initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GouvCommune[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // Reset the search once an import succeeds, so the list stops inviting a
  // second click on a commune that is now already in the base. Adjusting state
  // during render is React's documented pattern for responding to a changed
  // value, and avoids the extra render pass an effect would cost.
  const [lastOk, setLastOk] = useState(state.ok);
  if (state.ok !== lastOk) {
    setLastOk(state.ok);
    if (state.ok) {
      setQuery("");
      setResults([]);
    }
  }

  const active = query.trim().length >= MIN_QUERY;

  // Searches the public API straight from the browser. Debounced so typing a
  // name doesn't fire a request per keystroke, and ticketed so a slow early
  // response can't overwrite the results of a later query.
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) return;

    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchCommunes(q);
        if (ticket === latest.current) {
          setResults(found);
          setFailed(null);
        }
      } catch (e) {
        if (ticket === latest.current) {
          setResults([]);
          setFailed(e instanceof Error ? e.message : "Recherche indisponible.");
        }
      } finally {
        if (ticket === latest.current) setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="mb-6 rounded-xl border border-neutral-200 p-4">
      <h2 className="text-sm font-semibold">Ajouter une commune</h2>
      <p className="mt-1 mb-3 text-xs text-neutral-500">
        Recherche par nom, code postal ou code INSEE. Population, département et
        coordonnées sont remplis automatiquement depuis l’API du gouvernement.
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sillans-la-Cascade, 83690, 83128…"
        aria-label="Rechercher une commune à ajouter"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      />

      {active && searching && <p className="mt-2 text-xs text-neutral-500">Recherche…</p>}
      {active && failed && <p className="mt-2 text-xs text-red-600">{failed}</p>}

      {active && !searching && !failed && results.length === 0 && (
        <p className="mt-2 text-xs text-neutral-500">Aucune commune trouvée.</p>
      )}

      {active && results.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {results.map((c) => (
            <li
              key={c.inseeCode}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-neutral-500">
                  {c.inseeCode} · {c.department ?? "—"} ·{" "}
                  {c.population?.toLocaleString("fr-FR") ?? "?"} hab.
                  {c.postalCode ? ` · ${c.postalCode}` : ""}
                </p>
              </div>

              <form action={formAction}>
                <input type="hidden" name="inseeCode" value={c.inseeCode} />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
                >
                  {pending ? "…" : "Ajouter"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {state.ok && (
        <p role="status" className="mt-2 text-xs text-green-700">
          {state.ok}
        </p>
      )}
      {state.error && (
        <p role="status" className="mt-2 text-xs text-red-600">
          {state.error}
        </p>
      )}
    </div>
  );
}
