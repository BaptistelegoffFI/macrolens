import { useEffect, useState } from "react";

import { meta } from "../api/endpoints";
import type { SourceOut } from "../api/types";
import { EmptyState } from "../components/shell/EmptyState";
import { Num } from "../components/table/Num";
import { useLanguage } from "../i18n/LanguageContext";
import { S } from "../i18n/strings";
import styles from "./SourcesView.module.css";

/** §11.3 Vue Sources & méthode (F8). La page méthodologie complète (§8
 * intégralement décrit) est un livrable de Phase 7 — cette vue donne déjà
 * les sources réelles et un résumé fidèle des formules effectivement
 * implémentées, pas un texte de remplissage. */
export function SourcesView() {
  const { t } = useLanguage();
  const [sources, setSources] = useState<SourceOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    meta
      .sources()
      .then((s) => {
        setSources(s);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t(S.common.unknownError));
        setLoading(false);
      });
    // Un seul chargement initial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t(S.sources.sectionTitle)(sources.length)}</div>
        {loading && <EmptyState>{t(S.common.loading)}</EmptyState>}
        {error && <EmptyState>{error}</EmptyState>}
        {sources
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((s) => (
            <div key={s.id} className={styles.card}>
              <div className={styles.cardTitle}>{s.full_name}</div>
              <div className={styles.cardMeta}>
                {s.url} · {t(S.sources.priority)} <Num value={s.priority} decimals={0} /> ·{" "}
                {t(S.sources.retrievedOn)} {s.retrieved_at}
                {s.file_sha256 && ` · sha256 ${s.file_sha256.slice(0, 12)}…`}
              </div>
              <div className={styles.cardCitation}>{s.citation}</div>
              <div className={styles.cardMeta}>{s.licence}</div>
            </div>
          ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t(S.sources.methodTitle)}</div>
        <div className={styles.body}>
          <p>
            <strong>{t(S.methodology.stateVectorTitle)}</strong> {t(S.methodology.stateVectorBody)}
          </p>

          <p>
            <strong>{t(S.methodology.normTitle)}</strong> {t(S.methodology.normBody)}
          </p>
          <div className={styles.formula}>{t(S.methodology.normFormula1)}</div>
          <p>{t(S.methodology.normBody2)}</p>
          <div className={styles.formula}>{t(S.methodology.normFormula2)}</div>

          <p>
            <strong>{t(S.methodology.distanceTitle)}</strong> {t(S.methodology.distanceBody)}
          </p>
          <div className={styles.formula}>{t(S.methodology.distanceFormula)}</div>
          <p>{t(S.methodology.distanceBody2)}</p>

          <p>
            <strong>{t(S.methodology.outcomesTitle)}</strong> {t(S.methodology.outcomesBody)}
          </p>
        </div>
      </div>
    </div>
  );
}
