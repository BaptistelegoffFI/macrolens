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

export interface FeatureDef {
  code: string;
  label: { fr: string; en: string };
  family: FeatureFamily;
}

export const FEATURES: FeatureDef[] = [
  { code: "infl_level", label: { fr: "Infl.", en: "Infl." }, family: "prices" },
  { code: "infl_accel", label: { fr: "Accél.", en: "Accel." }, family: "prices" },
  { code: "growth_level", label: { fr: "Croissance", en: "Growth" }, family: "activity" },
  { code: "growth_gap", label: { fr: "Écart croissance", en: "Growth gap" }, family: "activity" },
  { code: "unemp_gap", label: { fr: "Écart chômage", en: "Unemployment gap" }, family: "activity" },
  { code: "rate_short_real", label: { fr: "Court réel", en: "Real short" }, family: "rates" },
  { code: "rate_short_delta", label: { fr: "Δ 2 ans", en: "Δ 2y" }, family: "rates" },
  { code: "curve_slope", label: { fr: "Pente", en: "Slope" }, family: "rates" },
  { code: "debt_level", label: { fr: "Dette/PIB", en: "Debt/GDP" }, family: "debt" },
  { code: "debt_delta5", label: { fr: "Δ 5 ans", en: "Δ 5y" }, family: "debt" },
  { code: "credit_gap5", label: { fr: "Gap 5 ans", en: "5y gap" }, family: "credit" },
  { code: "equity_real_3y", label: { fr: "Actions réel 3a", en: "Real equity 3y" }, family: "markets" },
  { code: "house_real_3y", label: { fr: "Immobilier réel 3a", en: "Real housing 3y" }, family: "markets" },
  { code: "ca_level", label: { fr: "Compte courant", en: "Current account" }, family: "external" },
];

export function featuresByFamily(
  lang: Lang,
): { family: FeatureFamily; label: string; features: { code: string; label: string; family: FeatureFamily }[] }[] {
  return FEATURE_FAMILIES.map((family) => ({
    family,
    label: FAMILY_LABELS[family][lang],
    features: FEATURES.filter((f) => f.family === family).map((f) => ({
      code: f.code,
      label: f.label[lang],
      family: f.family,
    })),
  }));
}
