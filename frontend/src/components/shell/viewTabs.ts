import type { Bi } from "../../i18n/strings";
import { S } from "../../i18n/strings";

export interface ViewTab {
  key: string;
  label: Bi;
  shortcut: string;
}

/** §11.3 : les vues, chacune avec son raccourci (F9 : classes d'actifs, ADR 0022). */
export const VIEW_TABS: ViewTab[] = [
  { key: "scenario", label: S.viewTabs.scenario, shortcut: "F2" },
  { key: "episode", label: S.viewTabs.episode, shortcut: "F3" },
  { key: "series", label: S.viewTabs.series, shortcut: "F4" },
  { key: "compare", label: S.viewTabs.compare, shortcut: "F6" },
  { key: "coverage", label: S.viewTabs.coverage, shortcut: "F7" },
  { key: "sources", label: S.viewTabs.sources, shortcut: "F8" },
  { key: "assets", label: S.viewTabs.assets, shortcut: "F9" },
];
