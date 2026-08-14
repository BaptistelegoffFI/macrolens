import type { AnalogsSearchResponse, ObservationKey } from "../api/types";
import { RAW_INDICATOR_CODES } from "./indicators";

/** Construit les clés d'observation réellement consommées par le rendu
 * d'une recherche d'analogues (§18.4 : le bordereau doit correspondre
 * exactement à ce qui est affiché, pas à un sur-ensemble). */
export function keysForAnalogsSearch(response: AnalogsSearchResponse): ObservationKey[] {
  const pairs = response.analogs.map((a) => ({ country: a.country, year: a.year }));
  const keys: ObservationKey[] = [];
  for (const { country, year } of pairs) {
    for (const code of RAW_INDICATOR_CODES) {
      keys.push({ country, indicator: code, period: `${year}-01-01`, freq: "A" });
    }
  }
  return keys;
}
