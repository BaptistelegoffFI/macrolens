import { useEffect, useState } from "react";

import { SeriesSparkline } from "../components/charts/SeriesSparkline";
import { StateVector } from "../components/scenario/StateVector";
import { EmptyState } from "../components/shell/EmptyState";
import { Num } from "../components/table/Num";
import { useCompare } from "../hooks/useCompare";
import { useLanguage } from "../i18n/LanguageContext";
import { S } from "../i18n/strings";
import { mostDivergent } from "../lib/compare";
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

  const divergent = data ? mostDivergent(data.episodes.map((ep) => ep.state?.features ?? null)) : null;

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
                aria-label={t(S.compare.removeTitle)}
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

      {error && <div className={styles.error}>{error}</div>}
      {loading && <EmptyState>{t(S.common.loading)}</EmptyState>}
      {!loading && !data && !error && <EmptyState>{t(S.compare.emptyPrompt)}</EmptyState>}
      {!loading && data && (
        <>
          <div className={styles.legends}>
            <p className={styles.legend}>{t(S.compare.divergenceLegend)}</p>
            <p className={styles.legend}>{t(S.stateVector.rankLegend)}</p>
          </div>
          <div className={styles.grid}>
            {data.episodes.map((ep) => (
              <div key={`${ep.country}-${ep.year}`} className={styles.column}>
                <div className={styles.columnHeader}>
                  {ep.country}&nbsp;
                  <Num value={ep.year} decimals={0} size="body" />
                </div>
                <div className={styles.state}>
                  {ep.state ? (
                    <StateVector features={ep.state.features} highlight={divergent ?? undefined} />
                  ) : (
                    <div className={styles.unavailable}>{t(S.compare.stateUnavailable)}</div>
                  )}
                </div>
                <div className={styles.charts}>
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
                        height="clamp(160px, 20vh, 320px)"
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
