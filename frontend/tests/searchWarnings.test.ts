import { describe, expect, it } from "vitest";

import { parseWarnings } from "../src/lib/searchWarnings";

// Phrases exactes du backend (backend/tests/unit/test_core_warnings.py les fige de son côté).
const EPOCH = (n: number) =>
  `Analogue distant de ${n} ans. Le rapprochement porte sur des positions relatives, pas sur des niveaux comparables. Structures économiques très différentes.`;
const SMALL_N =
  "Seulement 3 analogue(s) trouvé(s) : la distribution est affichée, les agrégats sont peu fiables.";
const CONCENTRATED =
  "Analogues concentrés sur 2 pays et 3 décennie(s) : plusieurs analogues peuvent correspondre à un même épisode historique plutôt qu'à des précédents indépendants.";
const HHI =
  "Indice de concentration élevé (HHI pays=0.13, HHI décennie=0.51) : plusieurs analogues peuvent appartenir au même épisode historique.";

describe("décodage des avertissements de recherche", () => {
  it("fusionne les avertissements d'analogues distants en un seul, à la place du premier", () => {
    const parsed = parseWarnings([EPOCH(67), EPOCH(94), EPOCH(68), HHI]);
    expect(parsed).toEqual([
      { kind: "epoch", count: 3, minYears: 67, maxYears: 94 },
      { kind: "hhi", country: "0.13", decade: "0.51" },
    ]);
  });

  it("décode les trois autres formes", () => {
    expect(parseWarnings([SMALL_N, CONCENTRATED])).toEqual([
      { kind: "smallN", n: 3 },
      { kind: "concentrated", countries: 2, decades: 3 },
    ]);
  });

  it("garde l'ordre d'émission du moteur", () => {
    const kinds = parseWarnings([SMALL_N, EPOCH(60), CONCENTRATED]).map((w) => w.kind);
    expect(kinds).toEqual(["smallN", "epoch", "concentrated"]);
  });

  it("conserve une phrase inconnue au lieu de la perdre", () => {
    expect(parseWarnings(["Nouvel avertissement."])).toEqual([
      { kind: "other", text: "Nouvel avertissement." },
    ]);
  });

  it("renvoie une liste vide sans avertissement", () => {
    expect(parseWarnings([])).toEqual([]);
  });
});
