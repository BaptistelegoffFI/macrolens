/** Décodage des avertissements d'une recherche d'analogues. L'API (backend/macrolens/core/
 * warnings.py) les renvoie comme des phrases françaises ; son contrat ne change pas, donc le client
 * les reconnaît par leur forme et les rend lui-même dans la langue choisie. Une phrase inconnue est
 * conservée telle quelle (jamais supprimée en silence). tests/searchWarnings.test.ts et
 * backend/tests/unit/test_core_warnings.py figent la même formulation : modifier l'une des deux
 * casse un test. */

export type ParsedWarning =
  | { kind: "epoch"; count: number; minYears: number; maxYears: number }
  | { kind: "smallN"; n: number }
  | { kind: "concentrated"; countries: number; decades: number }
  | { kind: "hhi"; country: string; decade: string }
  | { kind: "other"; text: string };

const EPOCH = /^Analogue distant de (\d+) ans\./;
const SMALL_N = /^Seulement (\d+) analogue\(s\) trouvé\(s\)/;
const CONCENTRATED = /^Analogues concentrés sur (\d+) pays et (\d+) décennie\(s\)/;
const HHI = /^Indice de concentration élevé \(HHI pays=([\d.]+), HHI décennie=([\d.]+)\)/;

/** Les avertissements « analogue distant de N ans » sont émis un par analogue éloigné : ils sont
 * fusionnés en un seul (nombre et écart minimal/maximal), à la place du premier d'entre eux. */
export function parseWarnings(raw: readonly string[]): ParsedWarning[] {
  const out: ParsedWarning[] = [];
  let epochIndex = -1;
  const years: number[] = [];
  for (const text of raw) {
    const epoch = EPOCH.exec(text);
    if (epoch) {
      if (epochIndex === -1) {
        epochIndex = out.length;
        out.push({ kind: "epoch", count: 0, minYears: 0, maxYears: 0 });
      }
      years.push(Number(epoch[1]));
      continue;
    }
    const smallN = SMALL_N.exec(text);
    if (smallN) {
      out.push({ kind: "smallN", n: Number(smallN[1]) });
      continue;
    }
    const concentrated = CONCENTRATED.exec(text);
    if (concentrated) {
      out.push({ kind: "concentrated", countries: Number(concentrated[1]), decades: Number(concentrated[2]) });
      continue;
    }
    const hhi = HHI.exec(text);
    if (hhi) {
      out.push({ kind: "hhi", country: hhi[1], decade: hhi[2] });
      continue;
    }
    out.push({ kind: "other", text });
  }
  if (epochIndex !== -1) {
    out[epochIndex] = {
      kind: "epoch",
      count: years.length,
      minYears: Math.min(...years),
      maxYears: Math.max(...years),
    };
  }
  return out;
}
