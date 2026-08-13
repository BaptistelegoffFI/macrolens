export interface ViewTab {
  key: string;
  label: string;
  shortcut: string;
}

/** §11.3 : les six vues, chacune avec son raccourci. */
export const VIEW_TABS: ViewTab[] = [
  { key: "scenario", label: "Scénario", shortcut: "F2" },
  { key: "episode", label: "Épisode", shortcut: "F3" },
  { key: "series", label: "Explorateur de séries", shortcut: "F4" },
  { key: "compare", label: "Comparateur", shortcut: "F6" },
  { key: "coverage", label: "Couverture", shortcut: "F7" },
  { key: "sources", label: "Sources & méthode", shortcut: "F8" },
];
