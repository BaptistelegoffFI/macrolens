import type { ReactNode } from "react";

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
  const items: ReactNode[] = [];
  items.push(buildId ? <>build {buildId}</> : "aucun build chargé");
  if (poolSize !== undefined) {
    items.push(
      <>
        <Num value={poolSize} decimals={0} /> candidats
      </>,
    );
  }
  if (excluded !== undefined) {
    items.push(
      <>
        <Num value={excluded} decimals={0} /> exclus
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
        HHI pays <Num value={hhiCountry} decimals={2} />
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
