import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import type { ReactNode } from "react";

import type { ObservationOut } from "../../api/types";
import { axisNumericStyle, baseChartOption, formatAxisNumber, tokens } from "../../charts/theme";
import { ChartFrame } from "./ChartFrame";
import { EChart } from "./EChart";

export interface SeriesSparklineProps {
  label: string;
  unit: string;
  observations: ObservationOut[];
  anchorYear: number;
  /** Hauteur du corps (nombre, chaîne CSS) ; « fill » remplit le parent flex. */
  height?: number | string;
  /** Action affichée à droite de l'en-tête (ex. bouton plein écran). */
  actions?: ReactNode;
}

/** Petit multiple (§11.2 « toutes les séries autour d'une année ») — une série brute, marqueur
 * vertical à l'ancre. Points manquants non reliés (connectNulls: false), pas d'interpolation
 * silencieuse (règle 3). Le titre et l'unité sont dans le cadre commun, plus dans le canvas. */
export function SeriesSparkline({
  label,
  unit,
  observations,
  anchorYear,
  height = "clamp(140px, 14vh, 240px)",
  actions,
}: SeriesSparklineProps) {
  const option = useMemo<EChartsOption>(() => {
    const data = observations
      .filter((o) => o.value !== null)
      .map((o) => [new Date(o.period_start).getFullYear(), o.value]);

    return {
      ...baseChartOption,
      grid: { left: 44, right: 8, top: 8, bottom: 20 },
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
        axisLabel: { ...axisNumericStyle.x.axisLabel, formatter: (v: number) => String(Math.round(v)) },
      },
      yAxis: {
        ...axisNumericStyle.y,
        type: "value" as const,
        splitNumber: 3,
        axisLabel: { ...axisNumericStyle.y.axisLabel, formatter: formatAxisNumber },
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
  }, [observations, anchorYear]);

  return (
    <ChartFrame title={label} unit={unit || undefined} actions={actions} height={height}>
      <EChart option={option} />
    </ChartFrame>
  );
}
