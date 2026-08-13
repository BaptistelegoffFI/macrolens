import type { AnalogsSearchResponse, ObservationKey } from "../api/types";
import { RAW_INDICATORS } from "./indicators";

/** Construit les clés d'observation réellement consommées par le rendu
 * d'une recherche d'analogues (§18.4 : le bordereau doit correspondre
 * exactement à ce qui est affiché, pas à un sur-ensemble). */
export function keysForAnalogsSearch(response: AnalogsSearchResponse): ObservationKey[] {
  const pairs = response.analogs.map((a) => ({ country: a.country, year: a.year }));
  const keys: ObservationKey[] = [];
  for (const { country, year } of pairs) {
    for (const ind of RAW_INDICATORS) {
      keys.push({ country, indicator: ind.code, period: `${year}-01-01`, freq: "A" });
    }
  }
  return keys;
}
