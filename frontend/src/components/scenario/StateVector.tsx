import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { featuresByFamily } from "../../lib/features";
import { Num } from "../table/Num";
import styles from "./StateVector.module.css";

export interface StateVectorFeature {
  feature_code: string;
  raw_value: number | null;
  pct_rank: number | null;
}

export interface StateVectorProps {
  features: readonly StateVectorFeature[];
  /** Codes de variables à mettre en évidence (ex. celles qui divergent le plus entre deux épisodes). */
  highlight?: ReadonlySet<string>;
  /** Affiche la légende de `r=` sous la liste (une fois par page suffit). */
  showLegend?: boolean;
}

/** Vecteur d'état à 14 variables, groupé par famille : un seul composant pour Scénario, Épisode et
 * Comparateur (mêmes libellés, mêmes groupes, même rendu). Chaque ligne porte la valeur brute et
 * son rang percentile `r=`, avec infobulle. */
export function StateVector({ features, highlight, showLegend = false }: StateVectorProps) {
  const { t, lang } = useLanguage();
  const byCode = new Map(features.map((f) => [f.feature_code, f]));
  return (
    <div>
      {featuresByFamily(lang).map((group) => {
        const rows = group.features.filter((f) => byCode.has(f.code));
        if (rows.length === 0) return null;
        return (
          <section key={group.family} className={styles.group} aria-label={group.label}>
            <div className={styles.groupTitle}>{group.label}</div>
            {rows.map((f) => {
              const sv = byCode.get(f.code)!;
              return (
                <div key={f.code} className={styles.row} data-highlight={highlight?.has(f.code) ?? false}>
                  <span className={styles.label}>{f.label}</span>
                  <span className={styles.values}>
                    <Num value={sv.raw_value} decimals={2} />
                    <span className={styles.rank} title={t(S.stateVector.rankTitle)}>
                      r=<Num value={sv.pct_rank} decimals={2} size="meta" />
                    </span>
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}
      {showLegend && <p className={styles.legend}>{t(S.stateVector.rankLegend)}</p>}
    </div>
  );
}
