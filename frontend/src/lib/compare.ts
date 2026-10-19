/** Présentation du Comparateur (ADR 0030) : quelles variables mettre en évidence. Aucune métrique
 * nouvelle : on trie des rangs percentile déjà affichés (`r=`), de l'écart le plus grand au plus
 * petit entre les épisodes comparés. */

export interface RankedFeature {
  feature_code: string;
  pct_rank: number | null;
}

/** Codes des `count` variables dont le rang percentile diverge le plus entre les épisodes
 * (écart maximum − minimum). Une variable sans rang dans au moins deux épisodes est ignorée ; un
 * écart nul n'est jamais mis en évidence. Ordre stable : à écart égal, ordre d'apparition. */
export function mostDivergent(
  episodes: readonly (readonly RankedFeature[] | null)[],
  count = 3,
): Set<string> {
  const ranks = new Map<string, number[]>();
  const order: string[] = [];
  for (const features of episodes) {
    for (const f of features ?? []) {
      if (f.pct_rank === null || Number.isNaN(f.pct_rank)) continue;
      if (!ranks.has(f.feature_code)) {
        ranks.set(f.feature_code, []);
        order.push(f.feature_code);
      }
      ranks.get(f.feature_code)!.push(f.pct_rank);
    }
  }
  const spreads = order
    .map((code, index) => {
      const values = ranks.get(code)!;
      return { code, index, spread: values.length >= 2 ? Math.max(...values) - Math.min(...values) : 0 };
    })
    .filter((s) => s.spread > 0);
  spreads.sort((a, b) => b.spread - a.spread || a.index - b.index);
  return new Set(spreads.slice(0, count).map((s) => s.code));
}
