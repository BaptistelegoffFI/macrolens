/** Échelles d'affichage de l'explorateur de séries (ADR 0013). Transformations
 * déterministes, appliquées à l'affichage uniquement : tableau et exports
 * gardent toujours les valeurs brutes, jamais de donnée modifiée en base. */

export type ScaleMode = "level" | "log" | "base100" | "zscore";
export type SeriesPoint = [number, number]; // [année, valeur]
export type PointsByCountry = Record<string, SeriesPoint[]>;

export type ScaleUnavailable = "non_positive" | "no_common_year";

export interface ScaleAvailability {
  log: ScaleUnavailable | null;
  base100: ScaleUnavailable | null;
}

export interface ScaleResult {
  /** Mode réellement appliqué (retombe sur « level » si le mode demandé est indisponible). */
  mode: ScaleMode;
  baseYear: number | null;
  series: PointsByCountry;
}

function nonEmpty(byCountry: PointsByCountry): SeriesPoint[][] {
  return Object.values(byCountry).filter((pts) => pts.length > 0);
}

/** Première année où toutes les séries non vides ont une observation. */
export function commonStartYear(byCountry: PointsByCountry): number | null {
  const all = nonEmpty(byCountry);
  if (all.length === 0) return null;
  const yearSets = all.map((pts) => new Set(pts.map((p) => p[0])));
  const common = [...yearSets[0]].filter((y) => yearSets.every((s) => s.has(y)));
  return common.length > 0 ? Math.min(...common) : null;
}

/** Log et base 100 exigent des valeurs strictement positives (un log ou un
 * rapport à une base nulle ou négative n'a pas de sens) ; la base 100 exige
 * en plus une année commune à toutes les séries. */
export function scaleAvailability(byCountry: PointsByCountry): ScaleAvailability {
  const all = nonEmpty(byCountry);
  const hasNonPositive = all.some((pts) => pts.some((p) => p[1] <= 0));
  return {
    log: hasNonPositive ? "non_positive" : null,
    base100: hasNonPositive
      ? "non_positive"
      : all.length > 0 && commonStartYear(byCountry) === null
        ? "no_common_year"
        : null,
  };
}

function zscore(points: SeriesPoint[]): SeriesPoint[] {
  const n = points.length;
  if (n === 0) return [];
  const mean = points.reduce((a, p) => a + p[1], 0) / n;
  const variance = points.reduce((a, p) => a + (p[1] - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  return points.map(([y, v]) => [y, sd === 0 ? 0 : (v - mean) / sd]);
}

export function applyScale(requested: ScaleMode, byCountry: PointsByCountry): ScaleResult {
  const availability = scaleAvailability(byCountry);

  if (requested === "log" && availability.log === null) {
    return { mode: "log", baseYear: null, series: byCountry };
  }

  if (requested === "base100" && availability.base100 === null) {
    const baseYear = commonStartYear(byCountry);
    const series: PointsByCountry = {};
    for (const [country, pts] of Object.entries(byCountry)) {
      const base = pts.find((p) => p[0] === baseYear)?.[1];
      series[country] = base === undefined ? [] : pts.map(([y, v]) => [y, (v / base) * 100]);
    }
    return { mode: "base100", baseYear, series };
  }

  if (requested === "zscore") {
    const series: PointsByCountry = {};
    for (const [country, pts] of Object.entries(byCountry)) series[country] = zscore(pts);
    return { mode: "zscore", baseYear: null, series };
  }

  return { mode: "level", baseYear: null, series: byCountry };
}
