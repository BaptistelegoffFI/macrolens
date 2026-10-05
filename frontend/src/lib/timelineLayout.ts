import type { EventOut } from "../api/types";

/** Mise en page de la frise d'événements de l'onglet Épisode. Fonctions pures : l'axe va de la
 * décennie du premier événement à celle du dernier, les événements sont rangés par couloir selon
 * leur type, et les libellés sont répartis sur des sous-lignes pour ne jamais se chevaucher. */

export type LaneId = "banking_crisis" | "war" | "regime" | "oil_shock" | "other";

export const LANE_ORDER: LaneId[] = ["banking_crisis", "war", "regime", "oil_shock", "other"];

const LANE_BY_KIND: Record<string, LaneId> = {
  banking_crisis: "banking_crisis",
  war: "war",
  monetary_regime: "regime",
  regime_change: "regime",
  oil_shock: "oil_shock",
};

export function laneOf(kind: string): LaneId {
  return LANE_BY_KIND[kind] ?? "other";
}

/** Année décimale d'une date ISO « AAAA-MM-JJ », sans passer par `Date` (pas de fuseau horaire). */
export function yearFraction(iso: string): number {
  const [y, m = "1", d = "1"] = iso.slice(0, 10).split("-");
  return Number(y) + (Number(m) - 1) / 12 + (Number(d) - 1) / 365;
}

export interface TimelineItem {
  id: number;
  lane: LaneId;
  label: string;
  /** Libellé complet, pour l'infobulle. */
  fullLabel: string;
  start: number;
  end: number;
  /** Vrai pour un événement daté d'un seul jour ou sans fin : repère plutôt que barre. */
  point: boolean;
  startLabel: string;
  endLabel: string | null;
}

/** Dans le couloir des crises bancaires, « Crise bancaire systémique (Suède, 1991) » répète ce que
 * dit déjà le couloir et le pays de la page : seule l'année reste, le libellé complet est dans
 * l'infobulle. Tout autre libellé est conservé tel quel. */
export function displayLabel(event: EventOut, label: string): string {
  if (event.kind === "banking_crisis") {
    const match = /\(([^,()]+),\s*(\d{4})\)\s*$/.exec(label);
    if (match) return match[2];
  }
  return label;
}

export function toItem(event: EventOut, label: string): TimelineItem {
  const start = yearFraction(event.date_start);
  const hasEnd = event.date_end !== null;
  const end = hasEnd ? yearFraction(event.date_end as string) : start;
  return {
    id: event.id,
    lane: laneOf(event.kind),
    label: displayLabel(event, label),
    fullLabel: label,
    start,
    end: Math.max(start, end),
    point: !hasEnd || end - start < 0.5,
    startLabel: event.date_start.slice(0, 10),
    endLabel: event.date_end ? event.date_end.slice(0, 10) : null,
  };
}

/** De la décennie du premier événement à celle du dernier, l'ancre et la fenêtre comprises. Une
 * étendue trop courte (un seul événement) est élargie pour garder un axe lisible. */
export function computeRange(
  items: TimelineItem[],
  anchorYear: number,
  windowStart: number,
  windowEnd: number,
): { min: number; max: number } {
  const years = [anchorYear, windowStart, windowEnd, ...items.flatMap((i) => [i.start, i.end])];
  let min = Math.floor(Math.min(...years) / 10) * 10;
  let max = Math.ceil(Math.max(...years) / 10) * 10;
  if (max - min < 30) {
    const mid = (min + max) / 2;
    min = Math.floor((mid - 15) / 10) * 10;
    max = min + 30;
  }
  return { min, max };
}

/** Plus petit pas « rond » (en années) qui laisse au moins `minPx` entre deux graduations. */
export function niceStep(span: number, innerWidth: number, minPx: number): number {
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100];
  const pxPerYear = innerWidth / span;
  return candidates.find((c) => c * pxPerYear >= minPx) ?? candidates[candidates.length - 1];
}

export function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let y = Math.ceil(min / step) * step; y <= max; y += step) out.push(y);
  return out;
}

export interface Placed {
  item: TimelineItem;
  x1: number;
  x2: number;
  row: number;
  /** Côté du libellé par rapport au repère : à droite, ou à gauche près du bord droit. */
  labelSide: "right" | "left";
  labelX: number;
  extentStart: number;
  extentEnd: number;
}

const LABEL_GAP = 6;
const MARKER_HALF = 4;
const ROW_GAP = 10;

/** Répartit les éléments d'un couloir sur des sous-lignes : un élément occupe l'espace de son
 * repère (ou de sa barre) plus celui de son libellé, et prend la première sous-ligne où il ne
 * chevauche personne. */
export function assignRows(
  items: TimelineItem[],
  xFor: (year: number) => number,
  labelWidth: (label: string) => number,
  rightEdge: number,
): { placed: Placed[]; rows: number } {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const rowEnds: number[] = [];
  const placed: Placed[] = [];
  for (const item of sorted) {
    const x1 = xFor(item.start);
    const x2 = item.point ? x1 : Math.max(xFor(item.end), x1 + 3);
    const w = labelWidth(item.label);
    const rightEnd = x2 + (item.point ? MARKER_HALF : 0) + LABEL_GAP + w;
    const side: "right" | "left" = rightEnd > rightEdge ? "left" : "right";
    const extentStart =
      side === "right" ? x1 - (item.point ? MARKER_HALF : 0) : x1 - MARKER_HALF - LABEL_GAP - w;
    const extentEnd = side === "right" ? rightEnd : x2 + (item.point ? MARKER_HALF : 0);
    let row = rowEnds.findIndex((end) => end + ROW_GAP <= extentStart);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(extentEnd);
    } else {
      rowEnds[row] = extentEnd;
    }
    placed.push({
      item,
      x1,
      x2,
      row,
      labelSide: side,
      labelX: side === "right" ? x2 + (item.point ? MARKER_HALF : 0) + LABEL_GAP : x1 - MARKER_HALF - LABEL_GAP,
      extentStart,
      extentEnd,
    });
  }
  return { placed, rows: Math.max(1, rowEnds.length) };
}

/** Largeur estimée d'un libellé en police sans empattement de 10 px. */
export function estimateLabelWidth(label: string): number {
  return label.length * 5.4;
}
