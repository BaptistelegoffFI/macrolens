import { describe, expect, it } from "vitest";

import type { AnalogsSearchRequest } from "../src/api/types";
import { barPercent, pageLabel } from "../src/lib/adminUsage";
import { searchDetail, searchLabel } from "../src/lib/usageLog";

const base = { k: 20, horizons: [1, 3], reference_frame: "era" } as unknown as AnalogsSearchRequest;

describe("journal d'usage : étiquettes", () => {
  it("étiquette une recherche par ancre « PAYS ANNÉE »", () => {
    expect(searchLabel({ ...base, mode: "anchor", anchor: { country: "SWE", year: 1991 } })).toBe("SWE 1991");
  });

  it("garde le pays de base d'un choc, marqué (shock)", () => {
    expect(
      searchLabel({ ...base, mode: "shock", shock: { base: { country: "USA", year: 1979 }, deltas: {} } }),
    ).toBe("USA 1979 (shock)");
  });

  it("n'expose aucune valeur saisie pour le mode manuel", () => {
    const request = { ...base, mode: "manual", state: { cpi_inflation: 12.3 } } as AnalogsSearchRequest;
    expect(searchLabel(request)).toBe("manual");
    expect(searchDetail(request)).not.toContain("12.3");
  });

  it("décrit mode, référentiel et k", () => {
    expect(searchDetail({ ...base, mode: "anchor", anchor: { country: "SWE", year: 1991 } })).toBe(
      "mode=anchor · era · k=20",
    );
  });
});

describe("panneau admin : aides", () => {
  it("nomme une vue connue, rend un identifiant inconnu tel quel", () => {
    const t = (entry: { fr: string; en: string }) => entry.en;
    expect(pageLabel("series", t)).not.toBe("series");
    expect(pageLabel("zzz", t)).toBe("zzz");
    expect(pageLabel(null, t)).toBe("");
  });

  it("calcule la largeur des barres sans diviser par zéro", () => {
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(0, 0)).toBe(0);
  });
});
