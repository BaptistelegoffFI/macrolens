import type {
  AssetClassOut,
  AssetHorizonCell,
  AssetReturnsResponse,
  CountryAssetClassesResponse,
} from "../../src/api/types";

const NO_EXCLUSIONS = { before_start: 0, truncated_end: 0, gap: 0, no_series: 0 };

export function cell(overrides: Partial<AssetHorizonCell> & { horizon: number }): AssetHorizonCell {
  return {
    n_requested: 5,
    n: 4,
    n_extreme: 0,
    n_interpolated: null,
    n_pegged: null,
    hit_rate: 0.25,
    cumulative: { median: -0.1578, q1: -0.3, q3: 0.05, min: -0.5, max: 0.2 },
    annualised: { median: -0.05, q1: -0.1, q3: 0.02, min: -0.2, max: 0.1 },
    max_drawdown: { median: -0.3, q1: -0.45, q3: -0.1, min: -0.6, max: 0 },
    exclusions: NO_EXCLUSIONS,
    ...overrides,
  };
}

const SERIES_IDS: Record<string, string> = {
  equities: "jst.equity_tr",
  govt_bonds: "jst.govt_bond_tr",
  cash: "jst.bill_return",
  housing: "jst.housing_tr",
  fx: "jst.fx_usd",
  inflation: "jst.cpi",
};

function klass(
  class_id: string,
  section: AssetClassOut["section"],
  return_basis: AssetClassOut["return_basis"],
  label: string,
  cells: AssetHorizonCell[],
  caveat: string | null = null,
): AssetClassOut {
  return {
    class_id,
    section,
    return_basis,
    series: {
      series_id: SERIES_IDS[class_id],
      asset_class: class_id,
      tier: 1,
      measure: "total_return",
      label_fr: label,
      label_en: label,
      caveat_fr: caveat,
      caveat_en: caveat,
      citation: "Jordà et al. (2019)",
      source: { id: "jst", citation: "JST", url: "https://www.macrohistory.net/", licence: "CC BY-NC-SA" },
      first_year: 1870,
      last_year: 2020,
    },
    countries: [{ country: "USA", first_year: 1870, last_year: 2020, n_obs: 150 }],
    cells,
  };
}

const horizons = [1, 3, 5, 10];

export const ASSET_RETURNS_FIXTURE: AssetReturnsResponse = {
  schema_version: "asset-returns/1",
  tier: 1,
  n_analogs: 5,
  horizons,
  classes: [
    klass(
      "equities",
      "core",
      "real_total_return",
      "Actions",
      horizons.map((h) =>
        cell({
          horizon: h,
          n_extreme: h === 1 ? 1 : 0,
          n_interpolated: 0,
          // 3 ans : aucune fenêtre complète pour aucun analogue.
          ...(h === 3
            ? {
                n: 0,
                hit_rate: null,
                cumulative: { median: null, q1: null, q3: null, min: null, max: null },
                annualised: { median: null, q1: null, q3: null, min: null, max: null },
                max_drawdown: { median: null, q1: null, q3: null, min: null, max: null },
                exclusions: { ...NO_EXCLUSIONS, truncated_end: 5 },
              }
            : {}),
        }),
      ),
    ),
    klass("govt_bonds", "core", "real_total_return", "Obligations", horizons.map((h) => cell({ horizon: h, hit_rate: 0.5 }))),
    klass("cash", "core", "real_total_return", "Bons du Trésor", horizons.map((h) => cell({ horizon: h }))),
    klass(
      "housing",
      "housing",
      "real_total_return",
      "Immobilier",
      horizons.map((h) => cell({ horizon: h, n_interpolated: 2 })),
      "Série la moins fiable du jeu.",
    ),
    klass(
      "fx",
      "fx",
      "nominal_fx_return",
      "Change",
      horizons.map((h) => cell({ horizon: h, n_pegged: 2 })),
    ),
    klass(
      "inflation",
      "inflation",
      "cpi_change",
      "Inflation",
      horizons.map((h) => cell({ horizon: h, hit_rate: null, max_drawdown: null })),
    ),
  ],
  forward_paths: [
    {
      class_id: "equities",
      horizon: 10,
      points: Array.from({ length: 11 }, (_, step) => ({
        step,
        n: 4,
        median: step * -0.02,
        q1: step * -0.04,
        q3: step * 0.01,
      })),
    },
    {
      class_id: "govt_bonds",
      horizon: 10,
      points: Array.from({ length: 11 }, (_, step) => ({
        step,
        n: 4,
        median: step * 0.01,
        q1: step * -0.01,
        q3: step * 0.03,
      })),
    },
  ],
};

export const COUNTRY_FIXTURE: CountryAssetClassesResponse = {
  schema_version: "asset-returns/1",
  country: "USA",
  from_year: 1929,
  to_year: 1932,
  series: [
    {
      series: ASSET_RETURNS_FIXTURE.classes[0].series,
      headline: "real_return",
      points: [
        { year: 1929, value: -0.03, nominal: -0.03, real: -0.03, level: null, interpolated: false },
        { year: 1930, value: -0.21, nominal: -0.23, real: -0.21, level: null, interpolated: false },
      ],
      summary: {
        available: true,
        start_year: 1929,
        end_year: 1932,
        partial_coverage: false,
        gaps: [],
        n_obs: 4,
        level_kind: "real_index",
        level_start: 100,
        level_end: 48.1,
        change: -0.5188,
        annualised: -0.1671,
        nominal_level_end: 38.6,
        nominal_change: -0.6144,
        nominal_annualised: -0.2,
        max_drawdown: -0.5188,
      },
    },
  ],
  tree: [
    {
      id: "equities",
      label_fr: "Actions",
      label_en: "Equities",
      series_id: "jst.equity_tr",
      status: "available",
      tier: 1,
      reason_fr: null,
      reason_en: null,
      children: [
        {
          id: "equities_sectors",
          label_fr: "Par secteur",
          label_en: "By sector",
          series_id: null,
          status: "group",
          tier: null,
          reason_fr: null,
          reason_en: null,
          children: [
            {
              id: "sector_technology",
              label_fr: "Technologie",
              label_en: "Technology",
              series_id: null,
              status: "not_ingested",
              tier: 3,
              reason_fr: "Secteurs américains uniquement, non ingérés.",
              reason_en: "US sectors only, not ingested.",
              children: [],
            },
          ],
        },
      ],
    },
    {
      id: "private_markets",
      label_fr: "Private equity et dette privée",
      label_en: "Private equity and private debt",
      series_id: null,
      status: "excluded",
      tier: null,
      reason_fr: "Exclu volontairement.",
      reason_en: "Deliberately excluded.",
      children: [],
    },
  ],
};
