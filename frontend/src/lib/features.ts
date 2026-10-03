/** Miroir de backend/macrolens/core/features.py (FEATURE_NAMES/FAMILY) — §8.1/§8.3. */

import type { Lang } from "../i18n/strings";

export const FEATURE_FAMILIES = [
  "prices",
  "activity",
  "rates",
  "debt",
  "credit",
  "markets",
  "external",
] as const;
export type FeatureFamily = (typeof FEATURE_FAMILIES)[number];

export const FAMILY_LABELS: Record<FeatureFamily, { fr: string; en: string }> = {
  prices: { fr: "Prix", en: "Prices" },
  activity: { fr: "Activité", en: "Activity" },
  rates: { fr: "Taux", en: "Rates" },
  debt: { fr: "Dette", en: "Debt" },
  credit: { fr: "Crédit", en: "Credit" },
  markets: { fr: "Marchés", en: "Markets" },
  external: { fr: "Externe", en: "External" },
};

/** Unité de saisie d'une variable, identique à celle calculée par le backend
 * (core/features.py) : une valeur saisie « 8,5 » pour un taux signifie 8,5 %. */
export type FeatureUnit = "pct" | "pp" | "pct_gdp" | "pp_gdp";

export const UNIT_LABELS: Record<FeatureUnit, { fr: string; en: string }> = {
  pct: { fr: "%", en: "%" },
  pp: { fr: "pp", en: "pp" },
  pct_gdp: { fr: "% PIB", en: "% GDP" },
  pp_gdp: { fr: "pp PIB", en: "pp GDP" },
};

export const UNIT_HELP: Record<FeatureUnit, { fr: string; en: string }> = {
  pct: { fr: "Pourcentage (8,5 signifie 8,5 %)", en: "Percent (8.5 means 8.5%)" },
  pp: {
    fr: "Points de pourcentage : variation ou écart entre deux taux (2 signifie +2 points)",
    en: "Percentage points: change in, or gap between, two rates (2 means +2 points)",
  },
  pct_gdp: { fr: "Pourcentage du PIB (60 signifie 60 % du PIB)", en: "Percent of GDP (60 means 60% of GDP)" },
  pp_gdp: {
    fr: "Points de pourcentage de PIB : variation d'un ratio au PIB (5 signifie +5 points de PIB)",
    en: "Percentage points of GDP: change in a ratio to GDP (5 means +5 points of GDP)",
  },
};

export interface FeatureDef {
  code: string;
  label: { fr: string; en: string };
  family: FeatureFamily;
  unit: FeatureUnit;
}

export interface FeatureView {
  code: string;
  label: string;
  family: FeatureFamily;
  unit: string;
  unitHelp: string;
}

export const FEATURES: FeatureDef[] = [
  { code: "infl_level", label: { fr: "Infl.", en: "Infl." }, family: "prices", unit: "pct" },
  { code: "infl_accel", label: { fr: "Accél.", en: "Accel." }, family: "prices", unit: "pp" },
  { code: "growth_level", label: { fr: "Croissance", en: "Growth" }, family: "activity", unit: "pct" },
  { code: "growth_gap", label: { fr: "Écart croissance", en: "Growth gap" }, family: "activity", unit: "pp" },
  { code: "unemp_gap", label: { fr: "Écart chômage", en: "Unemployment gap" }, family: "activity", unit: "pp" },
  { code: "rate_short_real", label: { fr: "Court réel", en: "Real short" }, family: "rates", unit: "pct" },
  { code: "rate_short_delta", label: { fr: "Δ 2 ans", en: "Δ 2y" }, family: "rates", unit: "pp" },
  { code: "curve_slope", label: { fr: "Pente", en: "Slope" }, family: "rates", unit: "pp" },
  { code: "debt_level", label: { fr: "Dette/PIB", en: "Debt/GDP" }, family: "debt", unit: "pct_gdp" },
  { code: "debt_delta5", label: { fr: "Δ 5 ans", en: "Δ 5y" }, family: "debt", unit: "pp_gdp" },
  { code: "credit_gap5", label: { fr: "Gap 5 ans", en: "5y gap" }, family: "credit", unit: "pp_gdp" },
  { code: "equity_real_3y", label: { fr: "Actions réel 3a", en: "Real equity 3y" }, family: "markets", unit: "pct" },
  { code: "house_real_3y", label: { fr: "Immobilier réel 3a", en: "Real housing 3y" }, family: "markets", unit: "pct" },
  { code: "ca_level", label: { fr: "Compte courant", en: "Current account" }, family: "external", unit: "pct_gdp" },
];

export function featuresByFamily(
  lang: Lang,
): { family: FeatureFamily; label: string; features: FeatureView[] }[] {
  return FEATURE_FAMILIES.map((family) => ({
    family,
    label: FAMILY_LABELS[family][lang],
    features: FEATURES.filter((f) => f.family === family).map((f) => ({
      code: f.code,
      label: f.label[lang],
      family: f.family,
      unit: UNIT_LABELS[f.unit][lang],
      unitHelp: UNIT_HELP[f.unit][lang],
    })),
  }));
}
