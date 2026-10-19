import { useEffect, useState } from "react";

import { getEvents } from "../api/endpoints";
import type { EventOut } from "../api/types";
import appStyles from "../App.module.css";
import { ChartLightbox } from "../components/charts/ChartLightbox";
import { EpisodeTimeline } from "../components/charts/EpisodeTimeline";
import { SeriesSparkline } from "../components/charts/SeriesSparkline";
import { StateVector } from "../components/scenario/StateVector";
import { EmptyState } from "../components/shell/EmptyState";
import { Panel } from "../components/shell/Panel";
import { ResizableColumns } from "../components/shell/ResizableColumns";
import { useEpisode } from "../hooks/useEpisode";
import { useLanguage } from "../i18n/LanguageContext";
import { S } from "../i18n/strings";
import { rawIndicators } from "../lib/indicators";
import surfaces from "../styles/surfaces.module.css";
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

  // Historique complet des événements du pays (la frise va du premier au dernier). L'API de
  // l'épisode ne renvoie que ceux proches de la fenêtre : on s'en sert seulement en repli si cet
  // appel échoue, pour que la page n'en dépende jamais.
  const [allEvents, setAllEvents] = useState<EventOut[] | null>(null);
  const episodeCountry = data?.country;
  useEffect(() => {
    if (!episodeCountry) return;
    let cancelled = false;
    setAllEvents(null);
    getEvents({ country: episodeCountry })
      .then((rows) => {
        if (!cancelled && Array.isArray(rows)) setAllEvents(rows);
      })
      .catch(() => {
        if (!cancelled) setAllEvents(null);
      });
    return () => {
      cancelled = true;
    };
  }, [episodeCountry]);

  useEffect(() => {
    void run(initialCountry, initialYear);
    // Un seul chargement initial ; les changements ultérieurs passent par le bouton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expandedIndicator = expanded ? rawIndicators(lang).find((i) => i.code === expanded) : undefined;

  return (
    <ResizableColumns storageKey="ml.episode.cols.v2" defaultWidths={[240]}>
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
            <button type="button" className={styles.load} onClick={() => void run(country, year)}>
              {t(S.episode.loadButton)}
            </button>
          </div>

          {data?.state && <StateVector features={data.state.features} showLegend />}
        </div>
      </Panel>

      <div className={styles.main}>
        {error && <div className={appStyles.errorBanner}>{error}</div>}
        {loading && <EmptyState>{t(S.common.loading)}</EmptyState>}
        {!loading && data && (
          <>
            <div className={styles.grid}>
              {rawIndicators(lang).map((ind) => (
                <div key={ind.code} className={styles.cell}>
                  <SeriesSparkline
                    label={ind.label}
                    unit={ind.unit}
                    observations={data.series[ind.code] ?? []}
                    anchorYear={data.year}
                    height="fill"
                    actions={
                      <button type="button" className={surfaces.btnLink} onClick={() => setExpanded(ind.code)}>
                        {t(S.episode.expand)}
                      </button>
                    }
                  />
                </div>
              ))}
            </div>
            <EpisodeTimeline
              events={allEvents ?? data.events}
              anchorYear={data.year}
              windowStart={data.year - 10}
              windowEnd={data.year + 10}
            />
            {data.sources.length > 0 && (
              <div className={styles.sources}>
                {t(S.episode.sourcesPrefix)} {data.sources.map((s) => s.id).join(", ")}
              </div>
            )}
          </>
        )}
        {expandedIndicator && data && (
          <ChartLightbox onClose={() => setExpanded(null)}>
            <SeriesSparkline
              label={expandedIndicator.label}
              unit={expandedIndicator.unit}
              observations={data.series[expandedIndicator.code] ?? []}
              anchorYear={data.year}
              height="fill"
            />
          </ChartLightbox>
        )}
      </div>
    </ResizableColumns>
  );
}
