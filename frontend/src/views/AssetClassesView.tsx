import { useEffect, useMemo, useState } from "react";

import { getCountryAssetClasses, meta } from "../api/endpoints";
import type {
  AssetCountrySeries,
  AssetRangeSummary,
  AssetTreeNode,
  CountryAssetClassesResponse,
  CountryOut,
} from "../api/types";
import { EmptyState } from "../components/shell/EmptyState";
import { Num } from "../components/table/Num";
import { useLanguage } from "../i18n/LanguageContext";
import { S } from "../i18n/strings";
import { percent } from "../lib/assetReturns";
import styles from "./AssetClassesView.module.css";

export interface AssetClassesPrefill {
  country: string;
  fromYear: number;
  toYear: number;
  anchorYear: number;
}

export interface AssetClassesViewProps {
  prefill: AssetClassesPrefill | null;
}

const ALL_TIERS = [1, 2, 3];

function parseYear(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1800 && n <= 2100 ? n : undefined;
}

/** Un groupe dont tous les enfants directs sont des lignes indisponibles démarre replié :
 * huit lignes « non disponible » identiques n'apprennent rien de plus que leur en-tête.
 * Les groupes qui contiennent des sous-groupes ou des lignes disponibles restent ouverts. */
function initiallyCollapsed(nodes: AssetTreeNode[]): Set<string> {
  const out = new Set<string>();
  const visit = (node: AssetTreeNode) => {
    if (
      node.children.length > 0 &&
      node.children.every((c) => c.children.length === 0 && c.status === "not_ingested")
    ) {
      out.add(node.id);
    }
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

function visible(node: AssetTreeNode, tiers: Set<number>): boolean {
  if (node.children.length > 0 && node.tier === null) {
    return node.children.some((c) => visible(c, tiers));
  }
  if (node.tier !== null && !tiers.has(node.tier)) {
    return node.children.some((c) => visible(c, tiers));
  }
  return true;
}

function gapsText(summary: AssetRangeSummary): string {
  return summary.gaps
    .map((g) => (g.start_year === g.end_year ? String(g.start_year) : `${g.start_year}-${g.end_year}`))
    .join(", ");
}

export function AssetClassesView({ prefill }: AssetClassesViewProps) {
  const { t, lang } = useLanguage();
  const [countries, setCountries] = useState<CountryOut[]>([]);
  const [country, setCountry] = useState(prefill?.country ?? "USA");
  const [fromYear, setFromYear] = useState(String(prefill?.fromYear ?? 1950));
  const [toYear, setToYear] = useState(String(prefill?.toYear ?? 2020));
  const [tiers, setTiers] = useState<Set<number>>(new Set(ALL_TIERS));
  const [basis, setBasis] = useState<"real" | "nominal">("real");
  const [collapsed, setCollapsed] = useState<Set<string> | null>(null);
  const [data, setData] = useState<CountryAssetClassesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const from = parseYear(fromYear);
  const to = parseYear(toYear);

  useEffect(() => {
    meta
      .countries()
      .then(setCountries)
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getCountryAssetClasses(country, from, to)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setCollapsed((current) => current ?? initiallyCollapsed(response.tree));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country, from, to]);

  const seriesById = useMemo(() => {
    const map = new Map<string, AssetCountrySeries>();
    data?.series.forEach((s) => map.set(s.series.series_id, s));
    return map;
  }, [data]);

  function toggleTier(tier: number) {
    setTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderDataCells(node: AssetTreeNode) {
    const series = node.series_id ? seriesById.get(node.series_id) : undefined;
    const reason = lang === "fr" ? node.reason_fr : node.reason_en;
    if (node.status === "not_ingested" || node.status === "excluded") {
      return (
        <td colSpan={5} className={styles.unavailable}>
          <span className={styles.unavailableLabel}>
            {node.status === "excluded" ? t(S.assets.excludedRow) : t(S.assets.notAvailable)}
          </span>
          {reason && <div className={styles.reason}>{reason}</div>}
        </td>
      );
    }
    if (node.status === "no_country_data" || !series) {
      return (
        <td colSpan={5} className={styles.unavailable}>
          <span className={styles.unavailableLabel}>{t(S.assets.noCountrySeries)}</span>
        </td>
      );
    }
    const summary = series.summary;
    if (!summary.available) {
      return (
        <td colSpan={5} className={styles.unavailable}>
          <span className={styles.unavailableLabel}>{t(S.assets.notAvailableAtDate)}</span>
        </td>
      );
    }
    const coverage =
      series.series.first_year !== null && series.series.last_year !== null
        ? t(S.assets.window)(series.series.first_year, series.series.last_year)
        : "";
    const isReturn = summary.level_kind === "real_index";
    const nominal = isReturn && basis === "nominal";
    const change = nominal ? summary.nominal_change : summary.change;
    const annualised = nominal ? summary.nominal_annualised : summary.annualised;
    const levelEnd = nominal ? summary.nominal_level_end : summary.level_end;
    const levelLabel =
      summary.level_kind === "real_index"
        ? nominal
          ? t(S.assets.levelNominalIndex)
          : t(S.assets.levelRealIndex)
        : summary.level_kind === "local_per_usd"
          ? t(S.assets.levelLocalPerUsd)
          : t(S.assets.levelCpi);
    const tone = summary.level_kind === "cpi_index" ? "none" : "auto";
    const levelDecimals = summary.level_kind === "local_per_usd" ? 3 : 1;
    return (
      <>
        <td className={styles.numCell}>
          <div className={styles.coverage}>{coverage}</div>
          {summary.start_year !== null && summary.end_year !== null && (
            <div className={styles.sub}>
              {summary.partial_coverage
                ? t(S.assets.partialCoverage)(summary.start_year, summary.end_year)
                : t(S.assets.window)(summary.start_year, summary.end_year)}
            </div>
          )}
        </td>
        {summary.gaps.length > 0 ? (
          <td colSpan={3} className={styles.unavailable}>
            <span className={styles.unavailableLabel}>{t(S.assets.gapsIn)(gapsText(summary))}</span>
          </td>
        ) : (
          <>
            <td className={styles.numCell}>
              <div>
                <Num value={summary.level_start} decimals={levelDecimals} />
                {" → "}
                <Num value={levelEnd} decimals={levelDecimals} />
              </div>
              <div className={styles.sub}>{levelLabel}</div>
            </td>
            <td className={styles.numCell}>
              <Num value={percent(change)} decimals={1} unit="%" sign tone={tone} />
            </td>
            <td className={styles.numCell}>
              <Num value={percent(annualised)} decimals={1} unit="%" sign tone={tone} />
              {summary.max_drawdown !== null && !nominal && (
                <div className={styles.sub}>
                  {t(S.assets.colDrawdown)} <Num value={percent(summary.max_drawdown)} decimals={1} unit="%" />
                </div>
              )}
            </td>
          </>
        )}
      </>
    );
  }

  function renderNode(node: AssetTreeNode, depth: number): React.ReactNode {
    if (!visible(node, tiers)) return null;
    const isGroup = node.children.length > 0;
    const isCollapsed = isGroup && (collapsed ?? new Set()).has(node.id);
    const label = lang === "fr" ? node.label_fr : node.label_en;
    const showData = node.status !== "group";
    const rows: React.ReactNode[] = [
      <tr key={node.id} className={styles.row} data-depth={depth} data-status={node.status}>
        <th scope="row" className={styles.label} style={{ paddingLeft: 8 + depth * 16 }}>
          {isGroup ? (
            <button
              type="button"
              className={styles.chevron}
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? t(S.assets.expand) : t(S.assets.collapse)} ${label}`}
              onClick={() => toggleCollapsed(node.id)}
            >
              {isCollapsed ? "▸" : "▾"}
            </button>
          ) : (
            <span className={styles.chevronSpacer} />
          )}
          {label}
        </th>
        <td className={styles.tierCell}>
          {node.tier !== null && (
            <span className={styles.tier} title={t(S.assets.tierTitle)(node.tier)}>
              {t(S.assets.tierBadge)(node.tier)}
            </span>
          )}
        </td>
        {showData ? renderDataCells(node) : <td colSpan={4} />}
      </tr>,
    ];
    if (isGroup && !isCollapsed) {
      node.children.forEach((child) => rows.push(renderNode(child, depth + 1)));
    }
    return rows;
  }

  const rangeInvalid = fromYear.trim() !== "" && from === undefined;
  const rangeInvalidTo = toYear.trim() !== "" && to === undefined;

  return (
    <div className={styles.layout}>
      <div className={styles.controls}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>{t(S.assets.pageControls)}</div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t(S.assets.country)}</span>
            <select className={styles.select} value={country} onChange={(e) => setCountry(e.target.value)}>
              {(countries.length > 0 ? countries : [{ iso3: country } as CountryOut]).map((c) => (
                <option key={c.iso3} value={c.iso3}>
                  {c.name_fr ? `${c.iso3} — ${lang === "fr" ? c.name_fr : c.name_en}` : c.iso3}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.periodRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t(S.assets.from)}</span>
              <input
                type="number"
                className={styles.yearInput}
                value={fromYear}
                aria-invalid={rangeInvalid}
                onChange={(e) => setFromYear(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t(S.assets.to)}</span>
              <input
                type="number"
                className={styles.yearInput}
                value={toYear}
                aria-invalid={rangeInvalidTo}
                onChange={(e) => setToYear(e.target.value)}
              />
            </label>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t(S.assets.tiers)}</span>
            <div className={styles.chips} role="group" aria-label={t(S.assets.tiers)}>
              {ALL_TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className={styles.chip}
                  data-active={tiers.has(tier)}
                  aria-pressed={tiers.has(tier)}
                  title={t(S.assets.tierTitle)(tier)}
                  onClick={() => toggleTier(tier)}
                >
                  {t(S.assets.tierBadge)(tier)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t(S.assets.basis)}</span>
            <div className={styles.chips} role="group" aria-label={t(S.assets.basis)}>
              <button
                type="button"
                className={styles.chip}
                data-active={basis === "real"}
                aria-pressed={basis === "real"}
                onClick={() => setBasis("real")}
              >
                {t(S.assets.basisReal)}
              </button>
              <button
                type="button"
                className={styles.chip}
                data-active={basis === "nominal"}
                aria-pressed={basis === "nominal"}
                onClick={() => setBasis("nominal")}
              >
                {t(S.assets.basisNominal)}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <p className={styles.intro}>{t(S.assets.pageIntro)}</p>
        {prefill && (
          <div className={styles.prefilled}>{t(S.assets.prefilteredFrom)(prefill.country, prefill.anchorYear)}</div>
        )}
        {loading && <EmptyState>{t(S.assets.pageLoading)}</EmptyState>}
        {error && (
          <div className={styles.notice} role="note">
            {t(S.assets.unavailable)}
          </div>
        )}
        {!loading && !error && data && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.colHead}>
                  {t(S.assets.colAsset)}
                </th>
                <th scope="col" className={styles.colHead}>
                  {t(S.assets.colTier)}
                </th>
                <th scope="col" className={styles.colHead}>
                  {t(S.assets.colCoverage)}
                </th>
                <th scope="col" className={styles.colHead}>
                  {t(S.assets.colLevel)}
                </th>
                <th scope="col" className={styles.colHead}>
                  {t(S.assets.colChange)}
                </th>
                <th scope="col" className={styles.colHead}>
                  {t(S.assets.colAnnualised)}
                </th>
              </tr>
            </thead>
            <tbody>{data.tree.map((node) => renderNode(node, 0))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
