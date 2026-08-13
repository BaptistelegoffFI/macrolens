/**
 * Thème ECharts centralisé (PLAN.md §11.5). Toute charte graphique passe
 * par ce fichier — aucun composant ne redéfinit ses propres couleurs ou
 * animations. Les valeurs hex reprennent les jetons de src/styles/tokens.css
 * (ECharts ne lit pas les custom properties CSS dans ses options).
 */
import type { EChartsOption } from "echarts";

export const tokens = {
  bgApp: "#ffffff",
  gridChart: "#eaecef",
  axis: "#8b9298",
  fg: "#16191c",
  // §11.8 : AA (4.5:1) exigé même à 10px — voir styles/tokens.css --fg-muted.
  fgMuted: "#6b7278",
  fanLine: "#c4c9ce",
  fanBand: "#dce6ef",
  series: ["#1f4e79", "#b3242b", "#4c7a34", "#7a5195", "#00707c", "#a85b00", "#5a6169", "#8c3a6b"],
} as const;

/** Base ECharts option appliquée à tout graphique du produit (§11.5). */
export const baseChartOption: EChartsOption = {
  animation: false,
  color: [...tokens.series],
  textStyle: {
    fontFamily: "IBM Plex Mono, ui-monospace, monospace",
    fontSize: 10,
    color: tokens.fg,
  },
  grid: {
    left: 48,
    right: 16,
    top: 24,
    bottom: 32,
    containLabel: false,
  },
  tooltip: {
    trigger: "axis",
    confine: true,
    backgroundColor: tokens.bgApp,
    borderColor: "#d2d6db",
    borderWidth: 1,
    textStyle: { color: tokens.fg, fontSize: 11 },
    axisPointer: { type: "cross", lineStyle: { color: tokens.axis, width: 1 } },
    // §11.5 : infobulle ancrée dans un coin fixe, jamais une bulle qui
    // suit le curseur — les vues concrètes fixent position: pour ancrer.
  },
};

/** Style d'axe partagé (§11.5) — à fusionner dans un xAxis/yAxis concret
 * de type explicite dans chaque graphique (le type union d'EChartsOption
 * empêche de préfabriquer un xAxis générique sans perdre l'inférence). */
export const axisNumericStyle = {
  x: {
    axisLine: { lineStyle: { color: tokens.axis, width: 1 } },
    axisTick: { length: 4, lineStyle: { color: tokens.axis } },
    axisLabel: { fontFamily: "IBM Plex Mono, ui-monospace, monospace", fontSize: 10 },
    splitLine: { show: false },
  },
  y: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { fontFamily: "IBM Plex Mono, ui-monospace, monospace", fontSize: 10 },
    splitLine: { show: true, lineStyle: { color: tokens.gridChart, width: 1, type: "solid" as const } },
  },
} as const;

/** Éventail des analogues (§11.5) : traits fins, bande Q1-Q3 en aplat, médiane épaisse. */
export const fanChartSeriesStyle = {
  analogLine: { color: tokens.fanLine, width: 0.75, opacity: 1 },
  band: { color: tokens.fanBand, opacity: 1 },
  median: { color: tokens.fg, width: 1.75 },
} as const;
