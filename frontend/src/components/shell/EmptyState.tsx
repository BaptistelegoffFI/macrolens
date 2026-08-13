import type { ReactNode } from "react";

import styles from "./EmptyState.module.css";

/** §11.7 : « les vides disent ce qu'il manque et où cliquer » — jamais un état vide muet. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}
