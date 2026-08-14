import { useEffect, useMemo, useState } from "react";

import { meta } from "../api/endpoints";
import type { CountryOut, CoverageCellOut, IndicatorOut } from "../api/types";
import { EmptyState } from "../components/shell/EmptyState";
import { Num } from "../components/table/Num";
import { useLanguage } from "../i18n/LanguageContext";
import { S } from "../i18n/strings";
import styles from "./CoverageView.module.css";

/** §11.3 Vue Couverture (F7) : matrice pays × indicateur × décennie.
 * L'infobulle de définition (`ind.definition_fr`) reste en français quel que
 * soit `lang` — il n'existe pas de `definition_en` en base (docs/limitations.md). */
export function CoverageView() {
  const { t, pick } = useLanguage();
  const [countries, setCountries] = useState<CountryOut[]>([]);
  const [indicators, setIndicators] = useState<IndicatorOut[]>([]);
  const [coverage, setCoverage] = useState<CoverageCellOut[]>([]);
  const [country, setCountry] = useState("FRA");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([meta.countries(), meta.indicators(), meta.coverage()])
      .then(([c, i, cov]) => {
        setCountries(c);
        setIndicators(i);
        setCoverage(cov);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t(S.common.unknownError));
        setLoading(false);
      });
    // Un seul chargement initial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decades = useMemo(() => {
    const set = new Set(coverage.map((c) => c.decade));
    return [...set].sort((a, b) => a - b);
  }, [coverage]);

  const cellByKey = useMemo(() => {
    const map = new Map<string, CoverageCellOut>();
    for (const c of coverage) {
      if (c.country_iso3 === country) map.set(`${c.indicator_code}-${c.decade}`, c);
    }
    return map;
  }, [coverage, country]);

  if (loading) return <EmptyState>{t(S.common.loading)}</EmptyState>;
  if (error) return <EmptyState>{error}</EmptyState>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className="micro-label">{t(S.coverage.country)}</span>
        <select className={styles.select} value={country} onChange={(e) => setCountry(e.target.value)}>
          {countries.map((c) => (
            <option key={c.iso3} value={c.iso3}>
              {c.iso3} — {pick(c.name_fr, c.name_en)}
            </option>
          ))}
        </select>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.rowHeader}>{t(S.coverage.indicator)}</th>
            {decades.map((d) => (
              <th key={d} className={styles.colHeader}>
                <Num value={d} decimals={0} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {indicators.map((ind) => (
            <tr key={ind.code}>
              <th className={styles.rowHeader} title={ind.definition_fr}>
                {pick(ind.label_fr, ind.label_en)}
              </th>
              {decades.map((d) => {
                const cell = cellByKey.get(`${ind.code}-${d}`);
                const pct = cell?.pct ?? 0;
                return (
                  <td
                    key={d}
                    className={styles.cell}
                    style={{ background: pct > 0 ? `rgba(11, 95, 165, ${pct / 100})` : undefined }}
                    title={cell ? `${cell.n_observed}/${cell.n_possible} (${pct.toFixed(0)}%)` : t(S.coverage.noData)}
                  >
                    <Num value={cell ? pct : null} decimals={0} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.legend}>{t(S.coverage.legend)}</div>
    </div>
  );
}
