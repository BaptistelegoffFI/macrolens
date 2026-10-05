import type { AssetHorizonCell, AssetQuantiles } from "../api/types";

export type AssetMetric = "cumulative" | "annualised" | "drawdown";

/** Ordre et libellés courts des lignes du bloc Scénario (ADR 0022). */
export const CLASS_LABELS: Record<string, { fr: string; en: string }> = {
  equities: { fr: "Actions", en: "Equities" },
  govt_bonds: { fr: "Obligations d'État", en: "Govt bonds" },
  cash: { fr: "Liquidités", en: "Cash" },
  housing: { fr: "Immobilier résidentiel", en: "Residential housing" },
  fx: { fr: "Change contre USD", en: "FX vs USD" },
  inflation: { fr: "Inflation", en: "Inflation" },
};

/** Séries proposées dans l'Explorateur de séries, en plus des indicateurs macro. */
export const ASSET_SERIES_OPTIONS: { id: string; fr: string; en: string }[] = [
  { id: "jst.equity_tr", fr: "Actions, rendement réel annuel", en: "Equities, real annual return" },
  { id: "jst.govt_bond_tr", fr: "Obligations d'État, rendement réel annuel", en: "Govt bonds, real annual return" },
  { id: "jst.bill_return", fr: "Bons du Trésor, rendement réel annuel", en: "T-bills, real annual return" },
  { id: "jst.housing_tr", fr: "Immobilier, rendement réel annuel", en: "Housing, real annual return" },
  { id: "jst.fx_usd", fr: "Change contre USD, variation annuelle", en: "FX vs USD, annual change" },
  { id: "jst.cpi", fr: "Inflation annuelle (prix)", en: "Annual inflation (prices)" },
];

export function percent(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value * 100;
}

/** Nombre d'analogues à rendement réel strictement positif (« 11 sur 20 »). */
export function positiveCount(cell: AssetHorizonCell): number | null {
  return cell.hit_rate === null ? null : Math.round(cell.hit_rate * cell.n);
}

export function quantilesFor(cell: AssetHorizonCell, metric: AssetMetric): AssetQuantiles | null {
  if (metric === "cumulative") return cell.cumulative;
  if (metric === "annualised") return cell.annualised;
  return cell.max_drawdown;
}

/** Pourquoi N est inférieur au nombre d'analogues, du motif le plus fréquent au moins fréquent. */
export function exclusionEntries(cell: AssetHorizonCell): [keyof AssetHorizonCell["exclusions"], number][] {
  return (Object.entries(cell.exclusions) as [keyof AssetHorizonCell["exclusions"], number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
}

/** Valeur annuelle (fraction) -> pourcentage affiché dans un graphique ECharts. */
export function axisPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function tooltipPercent(value: unknown): string {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : String(value);
}
