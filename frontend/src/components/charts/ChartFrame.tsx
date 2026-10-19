import type { ReactNode } from "react";

import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import styles from "./ChartFrame.module.css";

export interface ChartFrameProps {
  /** Titre du graphique (en-tête de colonne : majuscules, gris). Peut contenir des <Num>. */
  title: ReactNode;
  /** Unité ou échelle : pastille à droite du titre. */
  unit?: ReactNode;
  /** Actions à droite de l'en-tête (ex. « Plein écran »). */
  actions?: ReactNode;
  /** Pied de graphique, à gauche : sources, build, effectif… */
  footnote?: ReactNode;
  /** Active le lien « Exporter PNG » du pied. */
  onExport?: () => void;
  /** Hauteur du corps. Un nombre = pixels ; une chaîne CSS (ex. « clamp(…) ») ; « fill » = tout
   * l'espace restant du parent flex. */
  height?: number | string;
  children: ReactNode;
  className?: string;
}

/** Cadre commun de tous les graphiques (Scénario, Épisode, Comparateur, Séries, Actifs) : même
 * en-tête, même pied, même lien d'export. Le titre n'est plus dessiné dans le canvas ECharts, donc
 * il suit la langue et les jetons typographiques comme le reste de la page. */
export function ChartFrame({ title, unit, actions, footnote, onExport, height, children, className }: ChartFrameProps) {
  const { t } = useLanguage();
  const fill = height === "fill";
  return (
    <figure className={`${styles.frame} ${className ?? ""}`} data-fill={fill}>
      <figcaption className={styles.head}>
        <span className={styles.title}>{title}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
        {actions && <span className={styles.actions}>{actions}</span>}
      </figcaption>
      <div className={styles.body} style={height !== undefined && !fill ? { height } : undefined}>
        {children}
      </div>
      {(footnote || onExport) && (
        <div className={styles.foot}>
          <span>{footnote}</span>
          {onExport && (
            <button type="button" className={styles.export} onClick={onExport}>
              {t(S.seriesExplorer.exportPng)}
            </button>
          )}
        </div>
      )}
    </figure>
  );
}
