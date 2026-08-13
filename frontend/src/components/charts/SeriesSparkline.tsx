import type { EChartsOption } from "echarts";
import { useMemo } from "react";

import type { ObservationOut } from "../../api/types";
import { axisNumericStyle, baseChartOption, tokens } from "../../charts/theme";
import { EChart } from "./EChart";

export interface SeriesSparklineProps {
  label: string;
  unit: string;
  observations: ObservationOut[];
  anchorYear: number;
}

/** Petit multiple (§11.2 « toutes les séries autour d'une année ») — une
 * série brute, marqueur vertical à l'ancre. Points manquants non reliés
 * (connectNulls: false), pas d'interpolation silencieuse (règle 3). */
export function SeriesSparkline({ label, unit, observations, anchorYear }: SeriesSparklineProps) {
  const option = useMemo<EChartsOption>(() => {
    const data = observations
      .filter((o) => o.value !== null)
      .map((o) => [new Date(o.period_start).getFullYear(), o.value]);

    return {
      ...baseChartOption,
      grid: { left: 44, right: 8, top: 20, bottom: 20 },
      title: {
        text: label.toUpperCase(),
        left: 0,
        top: 0,
        textStyle: { fontSize: 9, fontWeight: "normal", color: tokens.fgMuted },
        subtext: unit,
        subtextStyle: { fontSize: 9 },
      },
      tooltip: {
        ...baseChartOption.tooltip,
        trigger: "axis" as const,
        valueFormatter: (v) => (typeof v === "number" ? v.toFixed(1) : String(v)),
      },
      xAxis: {
        ...axisNumericStyle.x,
        type: "value" as const,
        min: anchorYear - 10,
        max: anchorYear + 10,
        splitNumber: 4,
        axisLabel: { ...axisNumericStyle.x.axisLabel, fontSize: 9, formatter: (v: number) => String(Math.round(v)) },
      },
      yAxis: {
        ...axisNumericStyle.y,
        type: "value" as const,
        splitNumber: 3,
        axisLabel: {
          ...axisNumericStyle.y.axisLabel,
          fontSize: 9,
          formatter: (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)),
        },
      },
      series: [
        {
          type: "line",
          data,
          symbol: "none",
          connectNulls: false,
          lineStyle: { color: tokens.series[0], width: 1 },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: tokens.axis, width: 1, type: "solid" },
            data: [{ xAxis: anchorYear }],
            label: { show: false },
          },
        },
      ],
    };
  }, [observations, label, unit, anchorYear]);

  return <EChart option={option} height={110} />;
}
