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

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t(S.assetMethodology.title)}</div>
        <div className={styles.body}>
          <p>{t(S.assetMethodology.intro)}</p>

          <p>
            <strong>{t(S.assetMethodology.realTitle)}</strong> {t(S.assetMethodology.realBody)}
          </p>
          <div className={styles.formula}>{t(S.assetMethodology.realFormula)}</div>

          <p>
            <strong>{t(S.assetMethodology.totalTitle)}</strong> {t(S.assetMethodology.totalBody)}
          </p>
          <p>
            <strong>{t(S.assetMethodology.localTitle)}</strong> {t(S.assetMethodology.localBody)}
          </p>
          <p>
            <strong>{t(S.assetMethodology.noImputeTitle)}</strong> {t(S.assetMethodology.noImputeBody)}
          </p>
          <p>
            <strong>{t(S.assetMethodology.medianTitle)}</strong> {t(S.assetMethodology.medianBody)}
          </p>
          <p>
            <strong>{t(S.assetMethodology.drawdownTitle)}</strong> {t(S.assetMethodology.drawdownBody)}
          </p>
          <p>
            <strong>{t(S.assetMethodology.tiersTitle)}</strong> {t(S.assetMethodology.tiersBody)}
          </p>
          <p>
            <strong>{t(S.assetMethodology.excludedSourcesTitle)}</strong>{" "}
            {t(S.assetMethodology.excludedSourcesBody)}
          </p>
          <p>
            <strong>{t(S.assetMethodology.privateTitle)}</strong> {t(S.assetMethodology.privateBody)}
          </p>
          <p>
            <strong>{t(S.assetMethodology.licenceTitle)}</strong> {t(S.assetMethodology.licenceBody)}
          </p>
        </div>
      </div>
    </div>
  );
}
