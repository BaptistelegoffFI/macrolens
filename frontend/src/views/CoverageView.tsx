import { useEffect, useMemo, useState } from "react";

import { meta } from "../api/endpoints";
import type { CountryOut, CoverageCellOut, IndicatorOut } from "../api/types";
import { EmptyState } from "../components/shell/EmptyState";
import styles from "./CoverageView.module.css";

/** §11.3 Vue Couverture (F7) : matrice pays × indicateur × décennie. */
export function CoverageView() {
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
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setLoading(false);
      });
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

  if (loading) return <EmptyState>Chargement…</EmptyState>;
  if (error) return <EmptyState>{error}</EmptyState>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className="micro-label">Pays</span>
        <select className={styles.select} value={country} onChange={(e) => setCountry(e.target.value)}>
          {countries.map((c) => (
            <option key={c.iso3} value={c.iso3}>
              {c.iso3} — {c.name_fr}
            </option>
          ))}
        </select>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.rowHeader}>Indicateur</th>
            {decades.map((d) => (
              <th key={d} className={styles.colHeader}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {indicators.map((ind) => (
            <tr key={ind.code}>
              <th className={styles.rowHeader} title={ind.definition_fr}>
                {ind.label_fr}
              </th>
              {decades.map((d) => {
                const cell = cellByKey.get(`${ind.code}-${d}`);
                const pct = cell?.pct ?? 0;
                return (
                  <td
                    key={d}
                    className={styles.cell}
                    style={{ background: pct > 0 ? `rgba(11, 95, 165, ${pct / 100})` : undefined }}
                    title={cell ? `${cell.n_observed}/${cell.n_possible} (${pct.toFixed(0)}%)` : "aucune donnée"}
                  >
                    {cell ? Math.round(pct) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.legend}>
        Complétude (%) des années observées par décennie. Case vide = aucune observation.
      </div>
    </div>
  );
}
