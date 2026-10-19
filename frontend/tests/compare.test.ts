import { describe, expect, it } from "vitest";

import { mostDivergent } from "../src/lib/compare";

const ep = (ranks: Record<string, number | null>) =>
  Object.entries(ranks).map(([feature_code, pct_rank]) => ({ feature_code, pct_rank }));

describe("Comparateur : variables qui divergent le plus", () => {
  it("retient les trois plus grands écarts de rang percentile entre deux épisodes", () => {
    const a = ep({ infl_level: 0.73, growth_level: 0.03, rate_short_real: 0.63, debt_level: 0.67, ca_level: 0.23 });
    const b = ep({ infl_level: 0.43, growth_level: 0.03, rate_short_real: 0.83, debt_level: 0.63, ca_level: 0.03 });
    // écarts : infl 0.30, growth 0, rate 0.20, debt 0.04, ca 0.20
    expect([...mostDivergent([a, b])].sort()).toEqual(["ca_level", "infl_level", "rate_short_real"]);
  });

  it("n'invente rien : un écart nul n'est jamais mis en évidence", () => {
    const same = ep({ infl_level: 0.5, growth_level: 0.5 });
    expect(mostDivergent([same, same]).size).toBe(0);
  });

  it("utilise l'écart maximum − minimum quand plus de deux épisodes sont comparés", () => {
    const a = ep({ x: 0.1, y: 0.5 });
    const b = ep({ x: 0.9, y: 0.5 });
    const c = ep({ x: 0.5, y: 0.6 });
    expect([...mostDivergent([a, b, c], 1)]).toEqual(["x"]);
  });

  it("ignore les rangs manquants et les épisodes sans état", () => {
    const a = ep({ x: 0.1, y: null });
    const b = ep({ x: 0.9, y: 0.4 });
    expect([...mostDivergent([a, null, b])]).toEqual(["x"]);
  });

  it("garde l'ordre d'apparition à écart égal et respecte le nombre demandé", () => {
    const a = ep({ p: 0.0, q: 0.0, r: 0.0 });
    const b = ep({ p: 0.5, q: 0.5, r: 0.5 });
    expect([...mostDivergent([a, b], 2)]).toEqual(["p", "q"]);
  });
});
