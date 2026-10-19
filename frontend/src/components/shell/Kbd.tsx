import styles from "./Kbd.module.css";

/** Raccourci clavier (F2, Ctrl+L…) : mono, taille de métadonnée, gris. Même rendu dans les
 * onglets, sur les boutons et dans les textes d'aide. */
export function Kbd({ children }: { children: string }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}
