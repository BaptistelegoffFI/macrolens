import { useEffect, useState } from "react";

import appStyles from "../App.module.css";
import { EventFrieze } from "../components/charts/EventFrieze";
import { SeriesSparkline } from "../components/charts/SeriesSparkline";
import { EmptyState } from "../components/shell/EmptyState";
import { Panel } from "../components/shell/Panel";
import { ResizableColumns } from "../components/shell/ResizableColumns";
import { Num } from "../components/table/Num";
import { useEpisode } from "../hooks/useEpisode";
import { useLanguage } from "../i18n/LanguageContext";
import { S } from "../i18n/strings";
import { rawIndicators } from "../lib/indicators";
import styles from "./EpisodeView.module.css";

export interface EpisodeViewProps {
  initialCountry?: string;
  initialYear?: number;
}

/** §11.3 Vue Épisode (F3) : toutes les séries autour d'une année, frise
 * d'événements, ce qui a suivi. */
export function EpisodeView({ initialCountry = "SWE", initialYear = 1991 }: EpisodeViewProps) {
  const { t, lang } = useLanguage();
  const [country, setCountry] = useState(initialCountry);
  const [year, setYear] = useState(initialYear);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, loading, error, run } = useEpisode();

  useEffect(() => {
    void run(initialCountry, initialYear);
    // Un seul chargement initial ; les changements ultérieurs passent par le bouton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ResizableColumns storageKey="ml.episode.cols" defaultWidths={[220]}>
      <Panel title={t(S.episode.panelTitle)}>
        <div className={styles.left}>
          <div className={appStyles.fieldGroup}>
            <div className={appStyles.fieldGroupTitle}>{t(S.episode.searchGroupTitle)}</div>
            <div className={appStyles.field}>
              <span className={appStyles.fieldLabel}>{t(S.common.country)}</span>
              <input
                className={appStyles.textInput}
                value={country}
                maxLength={3}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
              />
            </div>
            <div className={appStyles.field}>
              <span className={appStyles.fieldLabel}>{t(S.common.year)}</span>
              <input
                className={appStyles.textInput}
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <button
              type="button"
              className={appStyles.textInput}
              style={{ width: "100%", marginTop: 8, cursor: "pointer" }}
              onClick={() => void run(country, year)}
            >
              {t(S.episode.loadButton)}
            </button>
          </div>

          {data?.state && (
            <div className={appStyles.fieldGroup}>
              <div className={appStyles.fieldGroupTitle}>{t(S.common.stateVector)}</div>
              <div className={styles.stateTable}>
                {data.state.features.map((f) => (
                  <div key={f.feature_code} className={styles.stateRow}>
                    <span>{f.feature_code}</span>
                    <span className={styles.stateRowValues}>
                      <Num value={f.raw_value} decimals={2} />
                      <span className={styles.stateRank}>
                        r=<Num value={f.pct_rank} decimals={2} />
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
        {error && <div className={appStyles.errorBanner}>{error}</div>}
        {loading && <EmptyState>{t(S.common.loading)}</EmptyState>}
        {!loading && data && (
          <>
            <div className={styles.grid}>
              {rawIndicators(lang).map((ind) => (
                <div key={ind.code} className={styles.cell} data-expanded={expanded === ind.code}>
                  <button
                    type="button"
                    className={styles.expandBtn}
                    onClick={() => setExpanded(expanded === ind.code ? null : ind.code)}
                  >
                    {t(expanded === ind.code ? S.episode.collapse : S.episode.expand)}
                  </button>
                  <SeriesSparkline
                    label={ind.label}
                    unit={ind.unit}
                    observations={data.series[ind.code] ?? []}
                    anchorYear={data.year}
                    height={expanded === ind.code ? 340 : 150}
                  />
                </div>
              ))}
            </div>
            <EventFrieze
              events={data.events}
              anchorYear={data.year}
              rangeStart={data.year - 10}
              rangeEnd={data.year + 10}
            />
            {data.sources.length > 0 && (
              <div style={{ padding: "8px 16px", fontSize: 11, color: "var(--fg-muted)" }}>
                {t(S.episode.sourcesPrefix)} {data.sources.map((s) => s.id).join(", ")}
              </div>
            )}
          </>
        )}
      </div>
    </ResizableColumns>
  );
}
