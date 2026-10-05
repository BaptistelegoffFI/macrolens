import type { EChartsOption } from "echarts";
import { useMemo } from "react";

import type { AssetForwardPath } from "../../api/types";
import { axisNumericStyle, baseChartOption, tokens } from "../../charts/theme";
import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { CLASS_LABELS, axisPercent, tooltipPercent } from "../../lib/assetReturns";
import { EChart } from "./EChart";

export interface AssetPathChartProps {
  paths: AssetForwardPath[];
}

/** Trajectoire médiane du rendement réel cumulé, avec bande Q1 à Q3, pour les
 * classes données (actions et obligations d'État). Seuls les précédents à fenêtre
 * complète comptent (le N de chaque point est dans l'infobulle de l'API, ADR 0019). */
export function AssetPathChart({ paths }: AssetPathChartProps) {
  const { t, lang } = useLanguage();

  const option = useMemo<EChartsOption>(() => {
    const series: NonNullable<EChartsOption["series"]> & unknown[] = [];
    paths.forEach((path, i) => {
      const color = tokens.series[i % tokens.series.length];
      const label = CLASS_LABELS[path.class_id]?.[lang] ?? path.class_id;
      const usable = path.points.filter((p) => p.n > 0 && p.median !== null);
      const stack = `band-${path.class_id}`;
      series.push(
        {
          type: "line",
          name: `${label} Q1`,
          stack,
          symbol: "none",
          silent: true,
          tooltip: { show: false },
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          data: usable.map((p) => [p.step, p.q1]),
        },
        {
          type: "line",
          name: `${label} ${t(S.assets.chartBand)}`,
          stack,
          symbol: "none",
          silent: true,
          tooltip: { show: false },
          lineStyle: { opacity: 0 },
          areaStyle: { color, opacity: 0.14 },
          data: usable.map((p) => [p.step, (p.q3 ?? 0) - (p.q1 ?? 0)]),
        },
        {
          type: "line",
          name: `${label}, ${t(S.assets.chartMedian)}`,
          symbol: "none",
          connectNulls: false,
          lineStyle: { color, width: 1.75 },
          data: usable.map((p) => [p.step, p.median]),
          ...(i === 0
            ? {
                markLine: {
                  silent: true,
                  symbol: "none" as const,
                  lineStyle: { color: tokens.axis, width: 1, type: "dashed" as const },
                  label: { show: false },
                  data: [{ yAxis: 0 }],
                },
              }
            : {}),
        },
      );
    });
    return {
      ...baseChartOption,
      grid: { left: 16, right: 24, top: 16, bottom: 16, containLabel: true },
      legend: { show: false },
      tooltip: {
        ...baseChartOption.tooltip,
        trigger: "axis" as const,
        valueFormatter: tooltipPercent,
      },
      xAxis: {
        ...axisNumericStyle.x,
        type: "value" as const,
        min: 0,
        max: Math.max(...paths.flatMap((p) => p.points.map((pt) => pt.step)), 1),
        interval: 1,
        axisLabel: { ...axisNumericStyle.x.axisLabel, formatter: (v: number) => String(v) },
      },
      yAxis: {
        ...axisNumericStyle.y,
        type: "value" as const,
        scale: true,
        axisLabel: { ...axisNumericStyle.y.axisLabel, formatter: axisPercent, margin: 10 },
      },
      series,
    };
  }, [paths, lang, t]);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, fontSize: 11, marginBottom: 4 }}>
        {paths.map((path, i) => (
          <span key={path.class_id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 2,
                background: tokens.series[i % tokens.series.length],
              }}
            />
            {CLASS_LABELS[path.class_id]?.[lang] ?? path.class_id}
          </span>
        ))}
      </div>
      <EChart option={option} height={220} />
    </div>
  );
}
