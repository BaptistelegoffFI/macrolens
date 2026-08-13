import styles from "./MenuBar.module.css";

const MENUS = ["Fichier", "Édition", "Scénario", "Données", "Fenêtre", "Aide"];

/** Barre de menus (§11.2). Les menus déroulants ne sont pas encore
 * implémentés (Phase 7) — pas de tabIndex sur des éléments encore inertes,
 * ce qui piégerait la navigation clavier sans rien y faire. */
export function MenuBar() {
  return (
    <div className={styles.bar} role="menubar" aria-label="Barre de menus">
      {MENUS.map((label) => (
        <div key={label} className={styles.menu} role="menuitem" aria-disabled="true">
          {label}
        </div>
      ))}
      <div className={styles.spacer} />
      <div className={styles.title}>MacroLens 1.0</div>
    </div>
  );
}
