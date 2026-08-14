import type { ReactNode } from "react";

import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { Num } from "../table/Num";
import styles from "./StatusBar.module.css";

export interface StatusBarProps {
  buildId?: string;
  poolSize?: number;
  excluded?: number;
  n?: number;
  hhiCountry?: number;
  elapsedMs?: number;
}

/** §11.2 : barre d'état toujours visible — la signature de l'application.
 * §12.4bis : chaque valeur numérique passe par <Num>, pas de littéral en dur. */
export function StatusBar({ buildId, poolSize, excluded, n, hhiCountry, elapsedMs }: StatusBarProps) {
  const { t } = useLanguage();
  const items: ReactNode[] = [];
  items.push(buildId ? <>{t(S.statusBar.build)(buildId)}</> : t(S.statusBar.noBuild));
  if (poolSize !== undefined) {
    items.push(
      <>
        <Num value={poolSize} decimals={0} /> {t(S.statusBar.candidates)}
      </>,
    );
  }
  if (excluded !== undefined) {
    items.push(
      <>
        <Num value={excluded} decimals={0} /> {t(S.statusBar.excluded)}
      </>,
    );
  }
  if (n !== undefined) {
    items.push(
      <>
        n=<Num value={n} decimals={0} />
      </>,
    );
  }
  if (hhiCountry !== undefined) {
    items.push(
      <>
        {t(S.statusBar.hhiCountry)} <Num value={hhiCountry} decimals={2} />
      </>,
    );
  }
  if (elapsedMs !== undefined) {
    items.push(
      <>
        <Num value={elapsedMs} decimals={0} /> ms
      </>,
    );
  }

  return (
    <div className={styles.bar} role="status">
      {items.map((item, i) => (
        <span key={i} className={styles.item}>
          {i > 0 && <span className={styles.sep}>· </span>}
          {item}
        </span>
      ))}
    </div>
  );
}
