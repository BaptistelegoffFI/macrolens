import { VIEW_TABS } from "../components/shell/viewTabs";
import type { Bi } from "../i18n/strings";

/** Libellé affichable d'un identifiant de vue (« series » → « Explorateur de séries »). Un
 * identifiant inconnu est rendu tel quel. */
export function pageLabel(name: string | null, t: (entry: Bi) => string): string {
  if (!name) return "";
  const tab = VIEW_TABS.find((v) => v.key === name);
  return tab ? t(tab.label) : name;
}

/** Largeur relative (0-100) d'une barre de classement ; 0 si le maximum est nul. */
export function barPercent(count: number, max: number): number {
  return max > 0 ? Math.round((count / max) * 100) : 0;
}
