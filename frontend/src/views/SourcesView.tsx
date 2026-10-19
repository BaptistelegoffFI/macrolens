import { useEffect, useState } from "react";

import { meta } from "../api/endpoints";
import type { SourceOut } from "../api/types";
import { EmptyState } from "../components/shell/EmptyState";
import { Section } from "../components/shell/Section";
import { Num } from "../components/table/Num";
import { useLanguage } from "../i18n/LanguageContext";
import { sourceTexts } from "../i18n/dataStrings";
import { S } from "../i18n/strings";
import type { Bi } from "../i18n/strings";
import styles from "./SourcesView.module.css";

type SourceTier = "primary" | "complementary" | "supporting";

/** Niveau d'une source selon sa priorité de résolution des conflits (§5.2) : primaire ≥ 90,
 * complémentaire de 50 à 89, appui en dessous. */
function tierOf(priority: number): SourceTier {
  return priority >= 90 ? "primary" : priority >= 50 ? "complementary" : "supporting";
}

/** §11.3 Vue Sources & méthode (F8). La page méthodologie complète (§8
 * intégralement décrit) est un livrable de Phase 7 — cette vue donne déjà
 * les sources réelles et un résumé fidèle des formules effectivement
 * implémentées, pas un texte de remplissage. */
export function SourcesView() {
  const { t, lang } = useLanguage();
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

  const ordered = sources.slice().sort((a, b) => b.priority - a.priority);
  const tiers: { key: SourceTier; title: Bi; items: SourceOut[] }[] = [
    { key: "primary", title: S.sources.tierPrimary, items: ordered.filter((s) => tierOf(s.priority) === "primary") },
    {
      key: "complementary",
      title: S.sources.tierComplementary,
      items: ordered.filter((s) => tierOf(s.priority) === "complementary"),
    },
    { key: "supporting", title: S.sources.tierSupporting, items: ordered.filter((s) => tierOf(s.priority) === "supporting") },
  ];

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.pageTitle}>{t(S.viewTabs.sources)}</h1>

      <Section level="group" title={t(S.sources.sectionTitle)(sources.length)} meta={t(S.sources.tierHelp)}>
        {loading && <EmptyState>{t(S.common.loading)}</EmptyState>}
        {error && <EmptyState>{error}</EmptyState>}
        {tiers
          .filter((tier) => tier.items.length > 0)
          .map((tier) => (
            <Section key={tier.key} level="block" title={t(tier.title)}>
              <div className={styles.cards}>
                {tier.items.map((s) => {
                  const text = sourceTexts(s, lang);
                  return (
                    <article key={s.id} className={styles.card} data-tier={tier.key}>
                      <h4 className={styles.cardTitle}>{text.full_name}</h4>
                      <p className={styles.cardMeta}>
                        <span className={styles.mono}>{s.url}</span> · {t(S.sources.priority)}{" "}
                        <Num value={s.priority} decimals={0} size="meta" /> · {t(S.sources.retrievedOn)}{" "}
                        <span className={styles.mono}>{s.retrieved_at}</span>
                        {s.file_sha256 && (
                          <>
                            {" "}
                            · sha256 <span className={styles.mono}>{s.file_sha256.slice(0, 12)}…</span>
                          </>
                        )}
                      </p>
                      <p className={styles.cardCitation}>{text.citation}</p>
                      <p className={styles.cardLicence}>{text.licence}</p>
                    </article>
                  );
                })}
              </div>
            </Section>
          ))}
      </Section>

      <Section level="group" title={t(S.sources.methodTitle)}>
        <p className={styles.prose}>
          <strong>{t(S.methodology.stateVectorTitle)}</strong> {t(S.methodology.stateVectorBody)}
        </p>

        <p className={styles.prose}>
          <strong>{t(S.methodology.normTitle)}</strong> {t(S.methodology.normBody)}
        </p>
        <div className={styles.formula}>{t(S.methodology.normFormula1)}</div>
        <p className={styles.prose}>{t(S.methodology.normBody2)}</p>
        <div className={styles.formula}>{t(S.methodology.normFormula2)}</div>

        <p className={styles.prose}>
          <strong>{t(S.methodology.distanceTitle)}</strong> {t(S.methodology.distanceBody)}
        </p>
        <div className={styles.formula}>{t(S.methodology.distanceFormula)}</div>
        <p className={styles.prose}>{t(S.methodology.distanceBody2)}</p>

        <p className={styles.prose}>
          <strong>{t(S.methodology.outcomesTitle)}</strong> {t(S.methodology.outcomesBody)}
        </p>
      </Section>

      <Section level="group" title={t(S.assetMethodology.title)}>
        <p className={styles.prose}>{t(S.assetMethodology.intro)}</p>

        <p className={styles.prose}>
          <strong>{t(S.assetMethodology.realTitle)}</strong> {t(S.assetMethodology.realBody)}
        </p>
        <div className={styles.formula}>{t(S.assetMethodology.realFormula)}</div>

        <p className={styles.prose}>
          <strong>{t(S.assetMethodology.totalTitle)}</strong> {t(S.assetMethodology.totalBody)}
        </p>
        <p className={styles.prose}>
          <strong>{t(S.assetMethodology.localTitle)}</strong> {t(S.assetMethodology.localBody)}
        </p>
        <p className={styles.prose}>
          <strong>{t(S.assetMethodology.noImputeTitle)}</strong> {t(S.assetMethodology.noImputeBody)}
        </p>
        <p className={styles.prose}>
          <strong>{t(S.assetMethodology.medianTitle)}</strong> {t(S.assetMethodology.medianBody)}
        </p>
        <p className={styles.prose}>
          <strong>{t(S.assetMethodology.drawdownTitle)}</strong> {t(S.assetMethodology.drawdownBody)}
        </p>
        <p className={styles.prose}>
          <strong>{t(S.assetMethodology.tiersTitle)}</strong> {t(S.assetMethodology.tiersBody)}
        </p>
        <p className={styles.prose}>
          <strong>{t(S.assetMethodology.excludedSourcesTitle)}</strong> {t(S.assetMethodology.excludedSourcesBody)}
        </p>
        <p className={styles.prose}>
          <strong>{t(S.assetMethodology.privateTitle)}</strong> {t(S.assetMethodology.privateBody)}
        </p>
        <p className={styles.prose}>
          <strong>{t(S.assetMethodology.licenceTitle)}</strong> {t(S.assetMethodology.licenceBody)}
        </p>
      </Section>
    </div>
  );
}
