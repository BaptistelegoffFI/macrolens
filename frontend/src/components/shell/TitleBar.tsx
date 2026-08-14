import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import styles from "./TitleBar.module.css";

/** Barre de titre — remplace l'ancienne barre de menus (Fichier/Édition/…),
 * dont les menus déroulants n'ont jamais été implémentés (§11.2, retiré
 * Phase 7 plutôt que laissé inerte indéfiniment). Porte désormais le
 * sélecteur de langue FR/EN. */
export function TitleBar() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className={styles.bar}>
      <span className={styles.title}>{t(S.titleBar.title)}</span>
      <div className={styles.spacer} />
      <div className={styles.langSwitch} role="group" aria-label={t(S.language.switchTitle)}>
        <button
          type="button"
          className={styles.langBtn}
          data-active={lang === "fr"}
          aria-pressed={lang === "fr"}
          onClick={() => setLang("fr")}
        >
          {t(S.language.fr)}
        </button>
        <button
          type="button"
          className={styles.langBtn}
          data-active={lang === "en"}
          aria-pressed={lang === "en"}
          onClick={() => setLang("en")}
        >
          {t(S.language.en)}
        </button>
      </div>
    </div>
  );
}
