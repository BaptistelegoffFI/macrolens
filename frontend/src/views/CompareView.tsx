import { useEffect, useState } from "react";

import { SeriesSparkline } from "../components/charts/SeriesSparkline";
import { EmptyState } from "../components/shell/EmptyState";
import { Num } from "../components/table/Num";
import { useCompare } from "../hooks/useCompare";
import { useLanguage } from "../i18n/LanguageContext";
import { S } from "../i18n/strings";
import { rawIndicators } from "../lib/indicators";
import styles from "./CompareView.module.css";

interface PairInput {
  country: string;
  year: number;
}

const DEFAULT_PAIRS: PairInput[] = [
  { country: "SWE", year: 1991 },
  { country: "FIN", year: 1990 },
];

export interface CompareViewProps {
  /** Couples imposés depuis l'extérieur (Ctrl+K, §11.3) — déclenche une
   * comparaison automatique quand ils changent. */
  externalPairs?: PairInput[];
}

/** §11.3 Vue Comparateur (F6) : 2 à 6 épisodes en colonnes, tableau +
 * petits multiples. */
export function CompareView({ externalPairs }: CompareViewProps) {
  const { t, lang } = useLanguage();
  const [pairs, setPairs] = useState<PairInput[]>(DEFAULT_PAIRS);
  const { data, loading, error, run } = useCompare();

  useEffect(() => {
    if (externalPairs && externalPairs.length >= 2) {
      setPairs(externalPairs);
      void run(externalPairs);
    }
    // Ne réagit qu'aux commandes externes explicites, pas à chaque frappe locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPairs]);

  function updatePair(i: number, field: "country" | "year", value: string) {
    setPairs((prev) =>
      prev.map((p, idx) =>
        idx === i ? { ...p, [field]: field === "year" ? Number(value) : value.toUpperCase() } : p,
      ),
    );
  }

  function addPair() {
    if (pairs.length >= 6) return;
    setPairs((prev) => [...prev, { country: "FRA", year: 2019 }]);
  }

  function removePair(i: number) {
    if (pairs.length <= 2) return;
    setPairs((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.pairsBar}>
        {pairs.map((p, i) => (
          <div key={i} className={styles.pairGroup}>
            <input
              className={styles.pairInput}
              value={p.country}
              maxLength={3}
              onChange={(e) => updatePair(i, "country", e.target.value)}
            />
            <input
              className={styles.pairInput}
              type="number"
              value={p.year}
              onChange={(e) => updatePair(i, "year", e.target.value)}
            />
            {pairs.length > 2 && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removePair(i)}
                title={t(S.compare.removeTitle)}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button type="button" className={styles.addBtn} onClick={addPair} disabled={pairs.length >= 6}>
          {t(S.compare.add)}
        </button>
        <button type="button" className={styles.runBtn} onClick={() => void run(pairs)}>
          {t(S.compare.run)}
        </button>
      </div>

      {error && <div style={{ color: "var(--neg)", padding: 8, fontSize: 11 }}>{error}</div>}
      {loading && <EmptyState>{t(S.common.loading)}</EmptyState>}
      {!loading && !data && !error && <EmptyState>{t(S.compare.emptyPrompt)}</EmptyState>}
      {!loading && data && (
        <div className={styles.grid}>
          {data.episodes.map((ep) => (
            <div key={`${ep.country}-${ep.year}`} className={styles.column}>
              <div className={styles.columnHeader}>
                {ep.country} <Num value={ep.year} decimals={0} />
              </div>
              {ep.state ? (
                ep.state.features.map((f) => (
                  <div key={f.feature_code} className={styles.featureRow}>
                    <span>{f.feature_code}</span>
                    <span className={styles.featureValues}>
                      <Num value={f.raw_value} decimals={2} />
                      <span className={styles.featureRank}>
                        r=<Num value={f.pct_rank} decimals={2} />
                      </span>
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles.featureRow}>
                  <span style={{ color: "var(--fg-muted)" }}>{t(S.compare.stateUnavailable)}</span>
                </div>
              )}
              {["gdp_real_pc", "cpi"].map((code) => {
                const ind = rawIndicators(lang).find((r) => r.code === code);
                if (!ind) return null;
                return (
                  <SeriesSparkline
                    key={code}
                    label={ind.label}
                    unit={ind.unit}
                    observations={ep.series[code] ?? []}
                    anchorYear={ep.year}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
