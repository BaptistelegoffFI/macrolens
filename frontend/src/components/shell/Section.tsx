import type { ReactNode } from "react";

import styles from "./Section.module.css";

export interface SectionProps {
  /** « group » : région majeure (titre de section + filet) ; « block » : sous-section. */
  level: "group" | "block";
  title: ReactNode;
  /** Métadonnée à droite du titre (effectif, fenêtre, aide). */
  meta?: ReactNode;
  children: ReactNode;
}

/** En-têtes de page à deux niveaux. Remplace les cinq variantes de titre de section observées à
 * l'audit (ADR 0030). */
export function Section({ level, title, meta, children }: SectionProps) {
  if (level === "group") {
    return (
      <section className={styles.group}>
        <header className={styles.groupHead}>
          <h2 className={styles.groupTitle}>{title}</h2>
          {meta && <span className={styles.groupMeta}>{meta}</span>}
        </header>
        {children}
      </section>
    );
  }
  return (
    <section className={styles.block}>
      <header className={styles.blockHead}>
        <h3 className={styles.blockTitle}>{title}</h3>
        {meta && <span className={styles.blockMeta}>{meta}</span>}
      </header>
      {children}
    </section>
  );
}
