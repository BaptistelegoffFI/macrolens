/** Miroir de backend/macrolens/core/features.py (FEATURE_NAMES/FAMILY) — §8.1/§8.3. */

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

export const FAMILY_LABELS: Record<FeatureFamily, string> = {
  prices: "Prix",
  activity: "Activité",
  rates: "Taux",
  debt: "Dette",
  credit: "Crédit",
  markets: "Marchés",
  external: "Externe",
};

export interface FeatureDef {
  code: string;
  label: string;
  family: FeatureFamily;
}

export const FEATURES: FeatureDef[] = [
  { code: "infl_level", label: "Infl.", family: "prices" },
  { code: "infl_accel", label: "Accél.", family: "prices" },
  { code: "growth_level", label: "Croissance", family: "activity" },
  { code: "growth_gap", label: "Écart croissance", family: "activity" },
  { code: "unemp_gap", label: "Écart chômage", family: "activity" },
  { code: "rate_short_real", label: "Court réel", family: "rates" },
  { code: "rate_short_delta", label: "Δ 2 ans", family: "rates" },
  { code: "curve_slope", label: "Pente", family: "rates" },
  { code: "debt_level", label: "Dette/PIB", family: "debt" },
  { code: "debt_delta5", label: "Δ 5 ans", family: "debt" },
  { code: "credit_gap5", label: "Gap 5 ans", family: "credit" },
  { code: "equity_real_3y", label: "Actions réel 3a", family: "markets" },
  { code: "house_real_3y", label: "Immobilier réel 3a", family: "markets" },
  { code: "ca_level", label: "Compte courant", family: "external" },
];

export function featuresByFamily(): { family: FeatureFamily; label: string; features: FeatureDef[] }[] {
  return FEATURE_FAMILIES.map((family) => ({
    family,
    label: FAMILY_LABELS[family],
    features: FEATURES.filter((f) => f.family === family),
  }));
}
