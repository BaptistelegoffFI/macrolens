import { useEffect } from "react";
import type { ReactNode } from "react";

import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import styles from "./ChartLightbox.module.css";

export interface ChartLightboxProps {
  onClose: () => void;
  /** Le graphique, rendu à pleine hauteur (un ChartFrame height="fill"). */
  children: ReactNode;
}

/** Plein écran d'un graphique : remplace les boutons « Agrandir » qui redimensionnaient une cellule.
 * Échap ou clic hors du cadre ferment ; le focus clavier reste dans la boîte. */
export function ChartLightbox({ onClose, children }: ChartLightboxProps) {
  const { t } = useLanguage();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.box} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
        <div>
          <button type="button" className={styles.close} onClick={onClose} autoFocus>
            {t(S.episode.collapse)}
          </button>
        </div>
      </div>
    </div>
  );
}
