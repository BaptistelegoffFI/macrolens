import { useServerWaking } from "../../hooks/useServerWaking";
import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import styles from "./WakingBanner.module.css";

/** Bandeau flottant (sans effet sur la mise en page) affiché pendant que le serveur, endormi par
 * l'hébergeur gratuit, se réveille. `role="note"` : la barre d'état possède déjà `role="status"`. */
export function WakingBanner() {
  const { t } = useLanguage();
  const waking = useServerWaking();
  if (!waking) return null;
  return (
    <div className={styles.banner} role="note" aria-live="polite" data-testid="waking-banner">
      {t(S.waking.message)}
    </div>
  );
}
