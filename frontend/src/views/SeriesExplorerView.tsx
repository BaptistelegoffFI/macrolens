import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";

import { getCountryAssetClasses, getSeries, meta } from "../api/endpoints";
import type {
  CountryAssetClassesResponse,
  CountryOut,
  IndicatorOut,
  ObservationOut,
} from "../api/types";
import { axisNumericStyle, baseChartOption, formatAxisNumber, tokens } from "../charts/theme";
import type { EChartHandle } from "../components/charts/EChart";
import { EChart } from "../components/charts/EChart";
import { EmptyState } from "../components/shell/EmptyState";
import { Num } from "../components/table/Num";
import { useLanguage } from "../i18n/LanguageContext";
import { S } from "../i18n/strings";
import type { Bi } from "../i18n/strings";
import { ASSET_SERIES_OPTIONS } from "../lib/assetReturns";
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

const MACRO = "macro:";
const ASSET = "asset:";
const isAssetKey = (key: string) => key.startsWith(ASSET);

interface Pair {
  id: string;
  country: string;
  key: string;
  color: string;
  label: string;
}

/** §11.3 Vue Explorateur de séries (F4) : pays × indicateurs, superposition, export.
 * Les classes d'actifs (ADR 0015 à 0024) s'ajoutent aux séries macro avec le même graphique
 * et le même modèle d'interaction : une série est une clé « macro:cpi » ou « asset:jst.equity_tr ». */
export function SeriesExplorerView() {
  const { t, pick, lang } = useLanguage();
  const [countries, setCountries] = useState<CountryOut[]>([]);
  const [indicators, setIndicators] = useState<IndicatorOut[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(DEFAULT_COUNTRIES);
  const [primary, setPrimary] = useState(`${MACRO}cpi`);
  const [overlays, setOverlays] = useState<string[]>([]);
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [scale, setScale] = useState<ScaleMode>("level");
  const [macroData, setMacroData] = useState<Record<string, Record<string, ObservationOut[]>>>({});
  const [assetData, setAssetData] = useState<Record<string, CountryAssetClassesResponse>>({});
  const [assetError, setAssetError] = useState(false);
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

  const activeKeys = useMemo(
    () => [primary, ...overlays.filter((k) => k !== primary)],
    [primary, overlays],
  );
  // Deux signatures distinctes : changer de série d'actifs ne relance aucun chargement macro, et
  // ajouter une 2e série d'actifs ne relance pas l'appel (l'endpoint renvoie déjà les six).
  const macroSignature = activeKeys
    .filter((k) => !isAssetKey(k))
    .map((k) => k.slice(MACRO.length))
    .join(",");
  const wantsAssets = activeKeys.some(isAssetKey);
  const [macroLoading, setMacroLoading] = useState(false);
  const [assetLoading, setAssetLoading] = useState(false);
  const loading = macroLoading || assetLoading;

  useEffect(() => {
    if (selectedCountries.length === 0 || macroSignature === "") {
      setMacroData({});
      setMacroLoading(false);
      return;
    }
    let cancelled = false;
    setMacroLoading(true);
    setError(null);
    const requests = macroSignature.split(",").flatMap((code) =>
      selectedCountries.map((c) =>
        getSeries({ country: c, indicator: code, from, to }).then((rows) => [code, c, rows] as const),
      ),
    );
    Promise.all(requests)
      .then((results) => {
        if (cancelled) return;
        const macro: Record<string, Record<string, ObservationOut[]>> = {};
        for (const [code, country, rows] of results) {
          (macro[code] ??= {})[country] = rows;
        }
        setMacroData(macro);
        setMacroLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t(S.common.unknownError));
        setMacroLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCountries, macroSignature, from, to, t]);

  // Les séries d'actifs sont chargées à part (allSettled) : leur échec ne doit jamais empêcher
  // l'affichage des séries macro (ADR 0024, dégradation gracieuse).
  useEffect(() => {
    if (selectedCountries.length === 0 || !wantsAssets) {
      setAssetData({});
      setAssetError(false);
      setAssetLoading(false);
      return;
    }
    let cancelled = false;
    setAssetLoading(true);
    setAssetError(false);
    Promise.allSettled(selectedCountries.map((c) => getCountryAssetClasses(c, from, to))).then(
      (results) => {
        if (cancelled) return;
        const assets: Record<string, CountryAssetClassesResponse> = {};
        let failed = false;
        results.forEach((result, i) => {
          if (result.status === "fulfilled" && Array.isArray(result.value?.series)) {
            assets[selectedCountries[i]] = result.value;
          } else {
            failed = true;
          }
        });
        setAssetData(assets);
        setAssetError(failed);
        setAssetLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedCountries, wantsAssets, from, to]);

  function toggleCountry(iso3: string) {
    setSelectedCountries((prev) => (prev.includes(iso3) ? prev.filter((c) => c !== iso3) : [...prev, iso3]));
  }

  function toggleOverlay(key: string) {
    setOverlays((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  const primaryCode = primary.startsWith(MACRO) ? primary.slice(MACRO.length) : null;
  const indicatorMeta = primaryCode ? indicators.find((i) => i.code === primaryCode) : undefined;

  function labelOf(key: string): string {
    if (isAssetKey(key)) {
      const option = ASSET_SERIES_OPTIONS.find((o) => `${ASSET}${o.id}` === key);
      return option ? option[lang] : key;
    }
    const code = key.slice(MACRO.length);
    const found = indicators.find((i) => i.code === code);
    return found ? pick(found.label_fr, found.label_en) : code;
  }

  const single = activeKeys.length === 1;
  const pairs = useMemo<Pair[]>(
    () =>
      activeKeys.flatMap((key, keyIndex) =>
        selectedCountries.map((country, countryIndex) => ({
          id: `${country}|${key}`,
          country,
          key,
          color: tokens.series[(keyIndex * selectedCountries.length + countryIndex) % tokens.series.length],
          label: single ? country : `${country} · ${labelOf(key)}`,
        })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeKeys, selectedCountries, single, lang, indicators],
  );

  // Points (année, valeur) de chaque paire. Une série d'actifs est affichée en pourcentage
  // (valeur annuelle x 100) ; les valeurs brutes de l'API restent des fractions.
  const pointsByPair = useMemo<PointsByCountry>(() => {
    const map: PointsByCountry = {};
    for (const pair of pairs) {
      if (isAssetKey(pair.key)) {
        const id = pair.key.slice(ASSET.length);
        const series = assetData[pair.country]?.series.find((s) => s.series.series_id === id);
        map[pair.id] = (series?.points ?? [])
          .filter((p) => p.value !== null)
          .map((p) => [p.year, (p.value as number) * 100]);
      } else {
        const code = pair.key.slice(MACRO.length);
        map[pair.id] = (macroData[code]?.[pair.country] ?? [])
          .filter((o) => o.value !== null)
          .map((o) => [new Date(o.period_start).getFullYear(), o.value as number]);
      }
    }
    return map;
  }, [pairs, macroData, assetData]);

  const availability = useMemo(() => scaleAvailability(pointsByPair), [pointsByPair]);
  const scaled = useMemo(() => applyScale(scale, pointsByPair), [scale, pointsByPair]);
  const effectiveScale = scaled.mode;
  const fellBack = scale !== effectiveScale;

  const option = useMemo<EChartsOption>(() => {
    const decimals2 = effectiveScale === "base100" || effectiveScale === "zscore";
    const series = pairs.map((pair, i) => ({
      type: "line" as const,
      name: pair.label,
      symbol: "none" as const,
      connectNulls: false,
      lineStyle: { color: pair.color, width: 1 },
      data: scaled.series[pair.id] ?? [],
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
  }, [pairs, scaled, effectiveScale]);

  const legendRows = pairs.map((pair) => {
    const points = pointsByPair[pair.id] ?? [];
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    // Variation en % d'une valeur déjà en %, ou d'une valeur nulle : pas de sens, pas affichée.
    const variation =
      !isAssetKey(pair.key) && last && prev && prev[1] !== 0 ? ((last[1] - prev[1]) / prev[1]) * 100 : null;
    return { pair, last: last ? last[1] : null, variation };
  });

  const singleMacroCode = single && primaryCode ? primaryCode : null;
  const exportName = single ? primary.slice(primary.indexOf(":") + 1) : "series";

  function buildRows(): (string | number | null)[][] {
    if (singleMacroCode) {
      const rows: (string | number | null)[][] = [["pays", "annee", "valeur"]];
      for (const c of selectedCountries) {
        for (const o of macroData[singleMacroCode]?.[c] ?? []) {
          rows.push([c, new Date(o.period_start).getFullYear(), o.value]);
        }
      }
      return rows;
    }
    const rows: (string | number | null)[][] = [["pays", "serie", "annee", "valeur"]];
    for (const pair of pairs) {
      for (const [year, value] of pointsByPair[pair.id] ?? []) {
        rows.push([pair.country, pair.key, year, value]);
      }
    }
    return rows;
  }

  function exportCsv() {
    downloadText(`${exportName}.csv`, toDelimited(buildRows(), ","), "text/csv");
  }

  function exportTsv() {
    downloadText(`${exportName}.tsv`, toDelimited(buildRows(), "\t"), "text/tab-separated-values");
  }

  function exportJson() {
    const payload = singleMacroCode
      ? macroData[singleMacroCode] ?? {}
      : Object.fromEntries(pairs.map((p) => [p.id, pointsByPair[p.id] ?? []]));
    downloadText(`${exportName}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  return (
    <div className={styles.layout}>
      <div className={styles.controls}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>{t(S.seriesExplorer.indicatorLabel)}</div>
          <select className={styles.select} value={primary} onChange={(e) => setPrimary(e.target.value)}>
            <optgroup label={t(S.assets.explorerMacroGroup)}>
              {indicators.map((i) => (
                <option key={i.code} value={`${MACRO}${i.code}`}>
                  {pick(i.label_fr, i.label_en)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t(S.assets.explorerAssetGroup)}>
              {ASSET_SERIES_OPTIONS.map((o) => (
                <option key={o.id} value={`${ASSET}${o.id}`}>
                  {o[lang]}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>{t(S.assets.explorerOverlayTitle)}</div>
          <div className={styles.countryList}>
            <div className={styles.overlayHeading}>{t(S.assets.explorerAssetGroup)}</div>
            {ASSET_SERIES_OPTIONS.filter((o) => `${ASSET}${o.id}` !== primary).map((o) => (
              <label key={o.id} className={styles.countryRow}>
                <input
                  type="checkbox"
                  checked={overlays.includes(`${ASSET}${o.id}`)}
                  onChange={() => toggleOverlay(`${ASSET}${o.id}`)}
                />
                {o[lang]}
              </label>
            ))}
            <div className={styles.overlayHeading}>{t(S.assets.explorerMacroGroup)}</div>
            {indicators
              .filter((i) => `${MACRO}${i.code}` !== primary)
              .map((i) => (
                <label key={i.code} className={styles.countryRow}>
                  <input
                    type="checkbox"
                    checked={overlays.includes(`${MACRO}${i.code}`)}
                    onChange={() => toggleOverlay(`${MACRO}${i.code}`)}
                  />
                  {pick(i.label_fr, i.label_en)}
                </label>
              ))}
          </div>
          {!single && effectiveScale === "level" && (
            <p className={styles.mixedHint}>
              {t(S.assets.explorerMixedUnits)}{" "}
              <button type="button" className={styles.periodResetBtn} onClick={() => setScale("zscore")}>
                {t(S.assets.explorerUseZ)}
              </button>
            </p>
          )}
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
        {assetError && !loading && (
          <div className={styles.assetNote} role="note">
            {t(S.assets.explorerAssetError)}
          </div>
        )}
        {loading && <EmptyState>{t(S.common.loading)}</EmptyState>}
        {!loading && (
          <>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <span className={styles.chartTitle}>{activeKeys.map(labelOf).join(" + ")}</span>
                {effectiveScale === "base100" && scaled.baseYear !== null ? (
                  <span className={styles.unitBadge}>{t(S.seriesExplorer.scaleBadgeBase100)(scaled.baseYear)}</span>
                ) : effectiveScale === "zscore" ? (
                  <span className={styles.unitBadge}>{t(S.seriesExplorer.scaleBadgeZscore)}</span>
                ) : (
                  <>
                    {single && indicatorMeta?.unit && (
                      <span className={styles.unitBadge}>{indicatorMeta.unit}</span>
                    )}
                    {single && isAssetKey(primary) && (
                      <span className={styles.unitBadge}>{t(S.assets.explorerAssetUnit)}</span>
                    )}
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
                    <tr key={r.pair.id}>
                      <td className={styles.legendCell}>
                        <span className={styles.swatch} style={{ background: r.pair.color }} />
                        {r.pair.label}
                      </td>
                      <td className={`${styles.legendCell} ${styles.legendNum}`}>
                        <Num value={r.last} decimals={2} />
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
                  if (url) downloadDataUrl(`${exportName}.png`, url);
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
