"use client";

import { useState } from "react";

export type MeteoCity = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export function MeteoPicker({ cities }: { cities: MeteoCity[] }) {
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");
  const [result, setResult] = useState("Sélectionnez une ville pour voir la météo.");

  async function fetchWeather() {
    const city = cities.find((c) => c.id === cityId);
    if (!city) {
      setResult("Aucune ville sélectionnée.");
      return;
    }

    setResult(`Chargement de la météo pour ${city.name}…`);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current_weather=true`,
      );
      const data = await res.json();
      const current = data?.current_weather;
      setResult(
        current
          ? `Météo à ${city.name} : ${current.temperature}°C (Vent : ${current.windspeed} km/h)`
          : "Impossible de récupérer la météo.",
      );
    } catch {
      setResult("Erreur de connexion au service météo.");
    }
  }

  if (cities.length === 0) {
    return <p className="text-sm text-neutral-600">Aucune commune avec coordonnées.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="meteo-city" className="text-sm font-medium">
          Choisissez une ville :
        </label>
        <select
          id="meteo-city"
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={fetchWeather}
          className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Voir la météo
        </button>
      </div>
      <p className="font-medium">{result}</p>
    </div>
  );
}
