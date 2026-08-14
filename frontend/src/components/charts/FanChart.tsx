import type { EChartsOption } from "echarts";
import { useMemo, useRef } from "react";

import type { AnalogsSearchResponse } from "../../api/types";
import { axisNumericStyle, baseChartOption, fanChartSeriesStyle } from "../../charts/theme";
import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { downloadDataUrl } from "../../lib/csv";
import { EChart } from "./EChart";
import type { EChartHandle } from "./EChart";

export interface FanChartProps {
  data: AnalogsSearchResponse;
  variable: string;
  variableLabel: string;
}

/**
 * §11.5 « Éventail ». Le backend n'expose les réalisations qu'à des
 * horizons discrets (§9 : 1/3/5/10 ans, pas de trajectoire continue) — ce
 * composant ne relie donc que des points réellement calculés, jamais une
 * valeur devinée entre deux horizons (règle 3, CLAUDE.md : zéro
 * extrapolation silencieuse). Le point (0,0) est ajouté car une variation
 * cumulée à l'horizon 0 vaut 0 par définition, pas par extrapolation.
 */
export function FanChart({ data, variable, variableLabel }: FanChartProps) {
  const { t } = useLanguage();
  const chartRef = useRef<EChartHandle>(null);
  const option = useMemo<EChartsOption>(() => {
    const horizons = Object.keys(data.aggregates)
      .map(Number)
      .sort((a, b) => a - b);

    const analogSeries = data.analogs.map((a) => ({
      type: "line" as const,
      name: `${a.country} ${a.year}`,
      showSymbol: true,
      symbolSize: 3,
      connectNulls: false,
      lineStyle: { color: fanChartSeriesStyle.analogLine.color, width: fanChartSeriesStyle.analogLine.width },
      itemStyle: { color: fanChartSeriesStyle.analogLine.color },
      silent: true,
      tooltip: { show: false },
      data: [
        [0, 0],
        ...horizons.map((h) => {
          const v = a.outcomes[String(h)]?.[variable];
          return [h, typeof v === "number" ? v : null];
        }),
      ],
    }));

    const q1Series = {
      type: "line" as const,
      name: "Q1",
      stack: "band",
      symbol: "none" as const,
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      silent: true,
      tooltip: { show: false },
      data: [
        [0, 0],
        ...horizons.map((h) => [h, data.aggregates[String(h)]?.[variable]?.q1 ?? 0]),
      ],
    };
    const q3MinusQ1Series = {
      type: "line" as const,
      name: "Q1–Q3",
      stack: "band",
      symbol: "none" as const,
      lineStyle: { opacity: 0 },
      areaStyle: { color: fanChartSeriesStyle.band.color, opacity: fanChartSeriesStyle.band.opacity },
      silent: true,
      tooltip: { show: false },
      data: [
        [0, 0],
        ...horizons.map((h) => {
          const agg = data.aggregates[String(h)]?.[variable];
          const q1 = agg?.q1 ?? 0;
          const q3 = agg?.q3 ?? 0;
          return [h, q3 - q1];
        }),
      ],
    };

    const medianSeries = {
      type: "line" as const,
      name: t(S.fanChart.median),
      showSymbol: true,
      symbolSize: 4,
      lineStyle: { color: fanChartSeriesStyle.median.color, width: fanChartSeriesStyle.median.width },
      itemStyle: { color: fanChartSeriesStyle.median.color },
      data: [
        [0, 0],
        ...horizons.map((h) => [h, data.aggregates[String(h)]?.[variable]?.median ?? null]),
      ],
    };

    return {
      ...baseChartOption,
      title: { text: t(S.fanChart.title)(variableLabel), left: 0, top: 0, textStyle: { fontSize: 11, fontWeight: "normal" } },
      grid: { left: 48, right: 16, top: 32, bottom: 32 },
      xAxis: {
        ...axisNumericStyle.x,
        type: "value" as const,
        name: t(S.fanChart.xAxisName),
        nameLocation: "middle" as const,
        nameGap: 20,
        min: 0,
      },
      yAxis: { ...axisNumericStyle.y, type: "value" as const },
      legend: { show: false },
      series: [q1Series, q3MinusQ1Series, ...analogSeries, medianSeries],
    };
  }, [data, variable, variableLabel, t]);

  function exportPng() {
    const url = chartRef.current?.getDataUrl();
    if (url) downloadDataUrl(`fan-chart-${variable}.png`, url);
  }

  return (
    <div>
      <EChart ref={chartRef} option={option} height={200} />
      {/* §11.5 : chaque graphique porte en pied source(s), build_id, export. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "2px 8px",
          fontSize: 9,
          color: "var(--fg-muted)",
        }}
      >
        <span>
          {data.sources_summary.map((s) => s.id).join(", ") || t(S.common.noSource)} · build{" "}
          {data.build_id.slice(0, 8)}
        </span>
        <button
          type="button"
          onClick={exportPng}
          style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: 9 }}
        >
          {t(S.seriesExplorer.exportPng)}
        </button>
      </div>
    </div>
  );
}
