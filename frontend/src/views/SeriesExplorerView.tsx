import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";

import { getSeries, meta } from "../api/endpoints";
import type { CountryOut, IndicatorOut, ObservationOut } from "../api/types";
import { axisNumericStyle, baseChartOption, tokens } from "../charts/theme";
import type { EChartHandle } from "../components/charts/EChart";
import { EChart } from "../components/charts/EChart";
import { EmptyState } from "../components/shell/EmptyState";
import { Num } from "../components/table/Num";
import { downloadDataUrl, downloadText, toDelimited } from "../lib/csv";
import styles from "./SeriesExplorerView.module.css";

const DEFAULT_COUNTRIES = ["FRA", "DEU", "ITA", "SWE", "FIN", "NOR"];

/** §11.3 Vue Explorateur de séries (F4) : pays × indicateurs, superposition, export. */
export function SeriesExplorerView() {
  const [countries, setCountries] = useState<CountryOut[]>([]);
  const [indicators, setIndicators] = useState<IndicatorOut[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(DEFAULT_COUNTRIES);
  const [indicator, setIndicator] = useState("cpi");
  const [seriesByCountry, setSeriesByCountry] = useState<Record<string, ObservationOut[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<EChartHandle>(null);

  useEffect(() => {
    Promise.all([meta.countries(), meta.indicators()]).then(([c, i]) => {
      setCountries(c);
      setIndicators(i);
    });
  }, []);

  useEffect(() => {
    if (selectedCountries.length === 0) {
      setSeriesByCountry({});
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all(selectedCountries.map((c) => getSeries({ country: c, indicator })))
      .then((results) => {
        const map: Record<string, ObservationOut[]> = {};
        selectedCountries.forEach((c, i) => {
          map[c] = results[i];
        });
        setSeriesByCountry(map);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setLoading(false);
      });
  }, [selectedCountries, indicator]);

  function toggleCountry(iso3: string) {
    setSelectedCountries((prev) => (prev.includes(iso3) ? prev.filter((c) => c !== iso3) : [...prev, iso3]));
  }

  const indicatorMeta = indicators.find((i) => i.code === indicator);

  const option = useMemo<EChartsOption>(() => {
    const series = selectedCountries.map((c, i) => ({
      type: "line" as const,
      name: c,
      symbol: "none" as const,
      connectNulls: false,
      lineStyle: { color: tokens.series[i % tokens.series.length], width: 1 },
      data: (seriesByCountry[c] ?? [])
        .filter((o) => o.value !== null)
        .map((o) => [new Date(o.period_start).getFullYear(), o.value]),
    }));
    return {
      ...baseChartOption,
      grid: { left: 56, right: 16, top: 16, bottom: 32 },
      legend: { show: false },
      tooltip: { ...baseChartOption.tooltip, trigger: "axis" as const },
      xAxis: { ...axisNumericStyle.x, type: "value" as const, axisLabel: { ...axisNumericStyle.x.axisLabel, formatter: (v: number) => String(Math.round(v)) } },
      yAxis: { ...axisNumericStyle.y, type: "value" as const },
      series,
    };
  }, [selectedCountries, seriesByCountry]);

  const legendRows = selectedCountries.map((c, i) => {
    const obs = (seriesByCountry[c] ?? []).filter((o) => o.value !== null);
    const last = obs[obs.length - 1];
    const prev = obs[obs.length - 2];
    const variation = last && prev && prev.value !== null ? (((last.value ?? 0) - prev.value) / prev.value) * 100 : null;
    return { country: c, color: tokens.series[i % tokens.series.length], last, variation };
  });

  function buildRows(): (string | number | null)[][] {
    const rows: (string | number | null)[][] = [["pays", "annee", "valeur"]];
    for (const c of selectedCountries) {
      for (const o of seriesByCountry[c] ?? []) {
        rows.push([c, new Date(o.period_start).getFullYear(), o.value]);
      }
    }
    return rows;
  }

  function exportCsv() {
    downloadText(`${indicator}.csv`, toDelimited(buildRows(), ","), "text/csv");
  }

  function exportTsv() {
    downloadText(`${indicator}.tsv`, toDelimited(buildRows(), "\t"), "text/tab-separated-values");
  }

  function exportJson() {
    downloadText(`${indicator}.json`, JSON.stringify(seriesByCountry, null, 2), "application/json");
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div className={styles.left} style={{ width: 220, borderRight: "1px solid var(--rule)" }}>
        <div className="micro-label" style={{ marginBottom: 4 }}>
          Indicateur
        </div>
        <select
          style={{ width: "100%", height: "var(--control-h)", border: "1px solid var(--rule)", fontSize: 11, marginBottom: 12 }}
          value={indicator}
          onChange={(e) => setIndicator(e.target.value)}
        >
          {indicators.map((i) => (
            <option key={i.code} value={i.code}>
              {i.label_fr}
            </option>
          ))}
        </select>

        <div className="micro-label" style={{ marginBottom: 4 }}>
          Pays ({selectedCountries.length})
        </div>
        <div className={styles.countryList}>
          {countries.map((c) => (
            <label key={c.iso3} className={styles.countryRow}>
              <input
                type="checkbox"
                checked={selectedCountries.includes(c.iso3)}
                onChange={() => toggleCountry(c.iso3)}
              />
              {c.iso3} — {c.name_fr}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.main}>
        {error && <div style={{ color: "var(--neg)", padding: 8, fontSize: 11 }}>{error}</div>}
        {loading && <EmptyState>Chargement…</EmptyState>}
        {!loading && (
          <>
            <div className={styles.chartArea}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--fg-secondary)", marginBottom: 4 }}>
                {indicatorMeta?.label_fr ?? indicator}
                <span style={{ color: "var(--fg-muted)", marginLeft: 8 }}>{indicatorMeta?.unit}</span>
              </div>
              <EChart ref={chartRef} option={option} height={280} />
            </div>
            <table className={styles.legend}>
              <tbody>
                {legendRows.map((r) => (
                  <tr key={r.country}>
                    <td className={styles.legendCell}>
                      <span className={styles.swatch} style={{ background: r.color }} />
                      {r.country}
                    </td>
                    <td className={`${styles.legendCell} ${styles.legendNum}`}>
                      <Num value={r.last?.value ?? null} decimals={2} />
                    </td>
                    <td className={`${styles.legendCell} ${styles.legendNum}`}>
                      <Num value={r.variation} decimals={1} unit="%" sign tone="auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.exportBar}>
              <button type="button" className={styles.exportBtn} onClick={exportCsv}>
                Exporter CSV
              </button>
              <button type="button" className={styles.exportBtn} onClick={exportTsv}>
                Exporter TSV
              </button>
              <button type="button" className={styles.exportBtn} onClick={exportJson}>
                Exporter JSON
              </button>
              <button
                type="button"
                className={styles.exportBtn}
                onClick={() => {
                  const url = chartRef.current?.getDataUrl();
                  if (url) downloadDataUrl(`${indicator}.png`, url);
                }}
              >
                Exporter PNG
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
