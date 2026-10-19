import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { parseWarnings } from "../../lib/searchWarnings";
import type { ParsedWarning } from "../../lib/searchWarnings";
import { EmptyState } from "../shell/EmptyState";
import styles from "./SearchWarnings.module.css";

/** Avertissements déterministes du moteur (§8.2.6, §9.4), dans la colonne de droite au-dessus de la
 * provenance. `warnings` vaut null tant qu'aucune recherche n'a abouti. Jamais silencieux : une
 * recherche sans avertissement le dit. */
export function SearchWarnings({ warnings }: { warnings: readonly string[] | null }) {
  const { t } = useLanguage();
  if (warnings === null) return <EmptyState>{t(S.warnings.placeholder)}</EmptyState>;
  if (warnings.length === 0) return <div className={styles.none}>{t(S.warnings.none)}</div>;

  const items = parseWarnings(warnings);
  return (
    <ul className={styles.list} aria-label={t(S.warnings.panelTitle)}>
      {items.map((w, i) => (
        <li key={i} className={styles.item}>
          <Card warning={w} />
        </li>
      ))}
    </ul>
  );
}

function Card({ warning }: { warning: ParsedWarning }) {
  const { t } = useLanguage();
  let title: string;
  let body: string;
  let note: string | null = null;
  switch (warning.kind) {
    case "epoch":
      title = t(S.warnings.epochTitle);
      body = t(S.warnings.epochBody)(warning.count, warning.minYears, warning.maxYears);
      note = t(S.warnings.epochExplain);
      break;
    case "smallN":
      title = t(S.warnings.smallNTitle);
      body = t(S.warnings.smallNBody)(warning.n);
      break;
    case "concentrated":
      title = t(S.warnings.concentratedTitle);
      body = t(S.warnings.concentratedBody)(warning.countries, warning.decades);
      break;
    case "hhi":
      title = t(S.warnings.hhiTitle);
      body = t(S.warnings.hhiBody)(warning.country, warning.decade);
      break;
    default:
      title = t(S.warnings.otherTitle);
      body = warning.text;
  }
  return (
    <>
      <div className={styles.title}>
        <span className={styles.flag} aria-hidden="true">
          ⚑
        </span>
        {title}
      </div>
      <p className={styles.body}>{body}</p>
      {note && <p className={styles.note}>{note}</p>}
    </>
  );
}
