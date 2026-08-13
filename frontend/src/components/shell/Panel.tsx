import type { ReactNode } from "react";

import styles from "./Panel.module.css";

export interface PanelProps {
  title: string;
  meta?: string;
  children: ReactNode;
}

/** Un panneau titré (24px) — brique de base des trois colonnes du §11.2. */
export function Panel({ title, meta, children }: PanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
