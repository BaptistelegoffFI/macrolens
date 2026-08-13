import styles from "./StatusBar.module.css";

export interface StatusBarProps {
  buildId?: string;
  poolSize?: number;
  excluded?: number;
  n?: number;
  hhiCountry?: number;
  elapsedMs?: number;
}

/** §11.2 : barre d'état toujours visible — la signature de l'application. */
export function StatusBar({ buildId, poolSize, excluded, n, hhiCountry, elapsedMs }: StatusBarProps) {
  const items: string[] = [];
  items.push(buildId ? `build ${buildId}` : "aucun build chargé");
  if (poolSize !== undefined) items.push(`${poolSize.toLocaleString("fr-FR")} candidats`);
  if (excluded !== undefined) items.push(`${excluded.toLocaleString("fr-FR")} exclus`);
  if (n !== undefined) items.push(`n=${n}`);
  if (hhiCountry !== undefined) items.push(`HHI pays ${hhiCountry.toFixed(2)}`);
  if (elapsedMs !== undefined) items.push(`${elapsedMs.toFixed(0)} ms`);

  return (
    <div className={styles.bar} role="status">
      {items.map((item, i) => (
        <span key={item} className={styles.item}>
          {i > 0 && <span className={styles.sep}>· </span>}
          {item}
        </span>
      ))}
    </div>
  );
}
