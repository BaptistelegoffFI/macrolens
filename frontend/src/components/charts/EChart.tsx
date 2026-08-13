import * as echarts from "echarts";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { EChartsOption } from "echarts";

export interface EChartProps {
  option: EChartsOption;
  height?: number | string;
}

export interface EChartHandle {
  /** §11.4/§18.6 : export PNG d'un graphique — utilise le rendu ECharts
   * réel, jamais une capture d'écran externe. */
  getDataUrl: () => string | null;
}

/** Wrapper minimal — pas de librairie tierce, juste init/dispose/resize.
 * Toute la charte visuelle vient de charts/theme.ts (§11.5), pas d'ici. */
export const EChart = forwardRef<EChartHandle, EChartProps>(function EChart({ option, height = "100%" }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useImperativeHandle(ref, () => ({
    getDataUrl: () => chartRef.current?.getDataURL({ pixelRatio: 2, backgroundColor: "#ffffff" }) ?? null,
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", resize);
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
});
