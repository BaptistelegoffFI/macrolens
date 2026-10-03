import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";

import { getSeries, meta } from "../api/endpoints";
import type { CountryOut, IndicatorOut, ObservationOut } from "../api/types";
import { axisNumericStyle, baseChartOption, formatAxisNumber, tokens } from "../charts/theme";
import type { EChartHandle } from "../components/charts/EChart";
import { EChart } from "../components/charts/EChart";
import { EmptyState } from "../components/shell/EmptyState";
import { Num } from "../components/table/Num";
import { useLanguage } from "../i18n/LanguageContext";
import { S } from "../i18n/strings";
import type { Bi } from "../i18n/strings";
import { downloadDataUrl, downloadText, toDelimited } from "../lib/csv";
import { applyScale, scaleAvailability } from "../lib/seriesScale";
import type { PointsByCountry, ScaleMode } from "../lib/seriesScale";
import styles from "./SeriesExplorerView.module.css";

const DEFAULT_COUNTRIES = ["FRA", "DEU", "ITA", "SWE", "FIN", "NOR"];

const SCALE_OPTIONS: { mode: ScaleMode; label: Bi }[] = [
  { mode: "level", label: S.seriesExplorer.scaleLevel },
  { mode: "log", label: S.seriesExplorer.scaleLog },
  { mode: "base100", label: S.seriesExplorer.scaleBase100 },
  { mode: "zscore", label: S.seriesExplorer.scaleZscore },
];

/** §11.3 Vue Explorateur de séries (F4) : pays × indicateurs, superposition, export. */
export function SeriesExplorerView() {
  const { t, pick } = useLanguage();
  const [countries, setCountries] = useState<CountryOut[]>([]);
  const [indicators, setIndicators] = useState<IndicatorOut[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(DEFAULT_COUNTRIES);
  const [indicator, setIndicator] = useState("cpi");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [scale, setScale] = useState<ScaleMode>("level");
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

  const from = fromYear !== "" && !Number.isNaN(Number(fromYear)) ? Number(fromYear) : undefined;
  const to = toYear !== "" && !Number.isNaN(Number(toYear)) ? Number(toYear) : undefined;

  useEffect(() => {
    if (selectedCountries.length === 0) {
      setSeriesByCountry({});
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all(selectedCountries.map((c) => getSeries({ country: c, indicator, from, to })))
      .then((results) => {
        const map: Record<string, ObservationOut[]> = {};
        selectedCountries.forEach((c, i) => {
          map[c] = results[i];
        });
        setSeriesByCountry(map);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t(S.common.unknownError));
        setLoading(false);
      });
  }, [selectedCountries, indicator, from, to, t]);

  function toggleCountry(iso3: string) {
    setSelectedCountries((prev) => (prev.includes(iso3) ? prev.filter((c) => c !== iso3) : [...prev, iso3]));
  }

  const indicatorMeta = indicators.find((i) => i.code === indicator);

  const pointsByCountry = useMemo<PointsByCountry>(() => {
    const map: PointsByCountry = {};
    for (const c of selectedCountries) {
      map[c] = (seriesByCountry[c] ?? [])
        .filter((o) => o.value !== null)
        .map((o) => [new Date(o.period_start).getFullYear(), o.value as number]);
    }
    return map;
  }, [selectedCountries, seriesByCountry]);

  const availability = useMemo(() => scaleAvailability(pointsByCountry), [pointsByCountry]);
  const scaled = useMemo(() => applyScale(scale, pointsByCountry), [scale, pointsByCountry]);
  const effectiveScale = scaled.mode;
  const fellBack = scale !== effectiveScale;

  const option = useMemo<EChartsOption>(() => {
    const decimals2 = effectiveScale === "base100" || effectiveScale === "zscore";
    const series = selectedCountries.map((c, i) => ({
      type: "line" as const,
      name: c,
      symbol: "none" as const,
      connectNulls: false,
      lineStyle: { color: tokens.series[i % tokens.series.length], width: 1 },
      data: scaled.series[c] ?? [],
      ...(i === 0 && (effectiveScale === "base100" || effectiveScale === "zscore")
        ? {
            markLine: {
              silent: true,
              symbol: "none" as const,
              lineStyle: { color: tokens.axis, width: 1, type: "dashed" as const },
              label: { show: false },
              data: [{ yAxis: effectiveScale === "base100" ? 100 : 0 }],
            },
          }
        : {}),
    }));
    const yLabel = (v: number): string => {
      if (effectiveScale === "zscore") return v.toFixed(1);
      if (effectiveScale === "log" && Math.abs(v) < 1) return v.toPrecision(1);
      return formatAxisNumber(v);
    };
    return {
      ...baseChartOption,
      // containLabel: true — la boîte grid inclut les libellés d'axe, donc
      // les marges ci-dessous sont une garantie de respiration minimale
      // plutôt qu'un calcul manuel de la largeur des libellés (fragile dès
      // qu'un indicateur produit des valeurs à forte amplitude, ex. un
      // indice actions nominal en période d'hyperinflation).
      grid: { left: 16, right: 24, top: 16, bottom: 16, containLabel: true },
      legend: { show: false },
      tooltip: {
        ...baseChartOption.tooltip,
        trigger: "axis" as const,
        ...(decimals2 ? { valueFormatter: (v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v)) } : {}),
      },
      xAxis: {
        ...axisNumericStyle.x,
        type: "value" as const,
        // scale: true — un axe de valeur inclut 0 par défaut ; pour des
        // années (jamais proches de 0), ça compressait toute la série
        // réelle dans un coin du graphique. §8.2 : jamais d'extrapolation,
        // mais ici il s'agit strictement d'un réglage d'affichage, pas
        // d'une transformation de donnée.
        scale: true,
        axisLabel: { ...axisNumericStyle.x.axisLabel, formatter: (v: number) => String(Math.round(v)) },
      },
      yAxis: {
        ...axisNumericStyle.y,
        ...(effectiveScale === "log"
          ? { type: "log" as const, logBase: 10 }
          : { type: "value" as const, scale: true }),
        axisLabel: { ...axisNumericStyle.y.axisLabel, formatter: yLabel, margin: 10 },
      },
      series,
    };
  }, [selectedCountries, scaled, effectiveScale]);

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
    <div className={styles.layout}>
      <div className={styles.controls}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>{t(S.seriesExplorer.indicatorLabel)}</div>
          <select className={styles.select} value={indicator} onChange={(e) => setIndicator(e.target.value)}>
            {indicators.map((i) => (
              <option key={i.code} value={i.code}>
                {pick(i.label_fr, i.label_en)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>{t(S.seriesExplorer.periodLabel)}</div>
          <div className={styles.periodRow}>
            <label className={styles.periodField}>
              <span className={styles.periodFieldLabel}>{t(S.seriesExplorer.periodFrom)}</span>
              <input
                type="number"
                className={styles.yearInput}
                value={fromYear}
                placeholder="1860"
                onChange={(e) => setFromYear(e.target.value)}
              />
            </label>
            <label className={styles.periodField}>
              <span className={styles.periodFieldLabel}>{t(S.seriesExplorer.periodTo)}</span>
              <input
                type="number"
                className={styles.yearInput}
                value={toYear}
                placeholder="2026"
                onChange={(e) => setToYear(e.target.value)}
              />
            </label>
          </div>
          {(fromYear !== "" || toYear !== "") && (
            <button
              type="button"
              className={styles.periodResetBtn}
              onClick={() => {
                setFromYear("");
                setToYear("");
              }}
            >
              {t(S.seriesExplorer.periodReset)}
            </button>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>{t(S.seriesExplorer.scaleLabel)}</div>
          <div className={styles.scaleGrid}>
            {SCALE_OPTIONS.map((opt) => {
              const reason = opt.mode === "log" || opt.mode === "base100" ? availability[opt.mode] : null;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  className={styles.scaleBtn}
                  data-active={effectiveScale === opt.mode}
                  aria-pressed={effectiveScale === opt.mode}
                  disabled={reason !== null}
                  title={
                    reason === "non_positive"
                      ? t(S.seriesExplorer.scaleUnavailableNonPositive)
                      : reason === "no_common_year"
                        ? t(S.seriesExplorer.scaleUnavailableNoCommonYear)
                        : undefined
                  }
                  onClick={() => setScale(opt.mode)}
                >
                  {t(opt.label)}
                </button>
              );
            })}
          </div>
          <p className={styles.scaleHelp}>
            {effectiveScale === "level" && t(S.seriesExplorer.scaleLevelHelp)}
            {effectiveScale === "log" && t(S.seriesExplorer.scaleLogHelp)}
            {effectiveScale === "base100" &&
              scaled.baseYear !== null &&
              t(S.seriesExplorer.scaleBase100Help)(scaled.baseYear)}
            {effectiveScale === "zscore" && t(S.seriesExplorer.scaleZscoreHelp)}
          </p>
          {fellBack && <p className={styles.scaleWarn}>{t(S.seriesExplorer.scaleFellBack)}</p>}
          {effectiveScale !== "level" && <p className={styles.scaleHelp}>{t(S.seriesExplorer.scaleRawNote)}</p>}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>{t(S.seriesExplorer.countriesLabel)(selectedCountries.length)}</div>
          <div className={styles.countryList}>
            {countries.map((c) => (
              <label key={c.iso3} className={styles.countryRow}>
                <input
                  type="checkbox"
                  checked={selectedCountries.includes(c.iso3)}
                  onChange={() => toggleCountry(c.iso3)}
                />
                {c.iso3} — {pick(c.name_fr, c.name_en)}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {error && <div style={{ color: "var(--neg)", padding: 8, fontSize: 11 }}>{error}</div>}
        {loading && <EmptyState>{t(S.common.loading)}</EmptyState>}
        {!loading && (
          <>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <span className={styles.chartTitle}>
                  {pick(indicatorMeta?.label_fr ?? indicator, indicatorMeta?.label_en ?? indicator)}
                </span>
                {effectiveScale === "base100" && scaled.baseYear !== null ? (
                  <span className={styles.unitBadge}>{t(S.seriesExplorer.scaleBadgeBase100)(scaled.baseYear)}</span>
                ) : effectiveScale === "zscore" ? (
                  <span className={styles.unitBadge}>{t(S.seriesExplorer.scaleBadgeZscore)}</span>
                ) : (
                  <>
                    {indicatorMeta?.unit && <span className={styles.unitBadge}>{indicatorMeta.unit}</span>}
                    {effectiveScale === "log" && (
                      <span className={styles.unitBadge}>{t(S.seriesExplorer.scaleBadgeLog)}</span>
                    )}
                  </>
                )}
              </div>
              <div className={styles.chartBody}>
                <EChart ref={chartRef} option={option} height={280} />
              </div>
            </div>

            <div className={styles.card}>
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
            </div>

            <div className={styles.exportBar}>
              <button type="button" className={styles.exportBtn} onClick={exportCsv}>
                {t(S.seriesExplorer.exportCsv)}
              </button>
              <button type="button" className={styles.exportBtn} onClick={exportTsv}>
                {t(S.seriesExplorer.exportTsv)}
              </button>
              <button type="button" className={styles.exportBtn} onClick={exportJson}>
                {t(S.seriesExplorer.exportJson)}
              </button>
              <button
                type="button"
                className={styles.exportBtn}
                onClick={() => {
                  const url = chartRef.current?.getDataUrl();
                  if (url) downloadDataUrl(`${indicator}.png`, url);
                }}
              >
                {t(S.seriesExplorer.exportPng)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
