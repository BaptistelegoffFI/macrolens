import { useMemo } from "react";

import type { EventOut } from "../../api/types";
import { useElementWidth } from "../../hooks/useElementWidth";
import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import {
  LANE_ORDER,
  assignRows,
  computeRange,
  estimateLabelWidth,
  niceStep,
  ticks,
  toItem,
} from "../../lib/timelineLayout";
import type { LaneId, Placed } from "../../lib/timelineLayout";
import styles from "./EpisodeTimeline.module.css";

export interface EpisodeTimelineProps {
  events: EventOut[];
  anchorYear: number;
  /** Fenêtre affichée par les graphiques de la page, surlignée sur la frise. */
  windowStart: number;
  windowEnd: number;
}

const HEADER_H = 44;
const LANE_PAD = 8;
const ROW_H = 20;
const AXIS_H = 28;
const RIGHT_PAD = 20;

/** Frise d'événements de l'onglet Épisode : de la décennie du premier événement à celle du
 * dernier, un couloir par type, des barres pour les périodes et des repères pour les dates, avec
 * l'ancre et la fenêtre des graphiques du dessus. */
export function EpisodeTimeline({ events, anchorYear, windowStart, windowEnd }: EpisodeTimelineProps) {
  const { t, pick } = useLanguage();
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const gutter = width < 700 ? 92 : 148;
  const innerWidth = Math.max(240, width - gutter - RIGHT_PAD);
  const rightEdge = width - 6;

  const laneTitles: Record<LaneId, string> = {
    banking_crisis: t(S.eventFrieze.laneBankingCrisis),
    war: t(S.eventFrieze.laneWar),
    regime: t(S.eventFrieze.laneRegime),
    oil_shock: t(S.eventFrieze.laneOilShock),
    other: t(S.eventFrieze.laneOther),
  };

  const layout = useMemo(() => {
    const items = events.map((e) => toItem(e, pick(e.label_fr, e.label_en)));
    const { min, max } = computeRange(items, anchorYear, windowStart, windowEnd);
    const xFor = (year: number) => gutter + ((year - min) / (max - min)) * innerWidth;
    const lanes = LANE_ORDER.map((lane) => {
      const own = items.filter((i) => i.lane === lane);
      const { placed, rows } = assignRows(own, xFor, estimateLabelWidth, rightEdge);
      return { lane, placed, rows, count: own.length };
    }).filter((l) => l.count > 0);
    let y = HEADER_H;
    const positioned = lanes.map((l) => {
      const height = LANE_PAD * 2 + l.rows * ROW_H;
      const out = { ...l, top: y, height };
      y += height;
      return out;
    });
    return { items, min, max, xFor, lanes: positioned, bodyBottom: y, step: niceStep(max - min, innerWidth, 54) };
  }, [events, anchorYear, windowStart, windowEnd, gutter, innerWidth, rightEdge, pick]);

  if (events.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.title}>{t(S.eventFrieze.title)}</div>
        <div className={styles.empty}>{t(S.eventFrieze.empty)}</div>
      </div>
    );
  }

  const { min, max, xFor, lanes, bodyBottom, step } = layout;
  const height = bodyBottom + AXIS_H;
  const anchorX = xFor(anchorYear);
  const anchorFlagLeft = anchorX > width - 140;
  const windowX1 = xFor(windowStart);
  const windowX2 = xFor(windowEnd);
  const windowLabel = t(S.eventFrieze.window)(windowStart, windowEnd);
  // Fenêtre proche de la fin de l'axe : le libellé s'aligne à droite plutôt que de dépasser.
  const windowLabelRight = windowX1 + 6 + windowLabel.length * 4.9 > width - 6;

  function renderItem(p: Placed, lane: LaneId, laneTop: number) {
    const cy = laneTop + LANE_PAD + p.row * ROW_H + ROW_H / 2;
    const end = p.item.endLabel ? ` → ${p.item.endLabel}` : "";
    return (
      <g key={p.item.id} className={styles.item} data-lane={lane}>
        <title>{`${p.item.fullLabel}\n${p.item.startLabel}${end}`}</title>
        {p.item.point ? (
          <rect
            x={p.x1 - 3.5}
            y={cy - 3.5}
            width={7}
            height={7}
            transform={`rotate(45 ${p.x1} ${cy})`}
            className={styles.marker}
          />
        ) : (
          <rect x={p.x1} y={cy - 4} width={Math.max(3, p.x2 - p.x1)} height={8} rx={1} className={styles.bar} />
        )}
        <text
          x={p.labelX}
          y={cy + 3.5}
          textAnchor={p.labelSide === "right" ? "start" : "end"}
          className={styles.eventLabel}
        >
          {p.item.label}
        </text>
      </g>
    );
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <div className={styles.title}>
        {t(S.eventFrieze.title)}
        <span className={styles.span}>{t(S.eventFrieze.span)(min, max)}</span>
      </div>
      <svg
        className={styles.svg}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t(S.eventFrieze.ariaLabel)(events.length, min, max)}
      >
        {lanes.map((l, i) => (
          <rect
            key={`bg-${l.lane}`}
            x={0}
            y={l.top}
            width={width}
            height={l.height}
            className={i % 2 === 0 ? styles.laneBgA : styles.laneBgB}
          />
        ))}

        <rect
          x={windowX1}
          y={0}
          width={Math.max(2, windowX2 - windowX1)}
          height={bodyBottom}
          className={styles.windowBand}
        />
        <text
          x={windowLabelRight ? Math.min(windowX2, width - 6) - 6 : windowX1 + 6}
          y={13}
          textAnchor={windowLabelRight ? "end" : "start"}
          className={styles.windowLabel}
        >
          {windowLabel}
        </text>

        {ticks(min, max, step).map((year) => (
          <g key={`tick-${year}`}>
            <line x1={xFor(year)} y1={HEADER_H - 6} x2={xFor(year)} y2={bodyBottom} className={styles.grid} />
            <line x1={xFor(year)} y1={bodyBottom} x2={xFor(year)} y2={bodyBottom + 5} className={styles.tick} />
            <text x={xFor(year)} y={bodyBottom + 19} textAnchor="middle" className={styles.yearLabel}>
              {year}
            </text>
          </g>
        ))}
        <line x1={gutter} y1={bodyBottom} x2={gutter + innerWidth} y2={bodyBottom} className={styles.axis} />

        {lanes.map((l) => (
          <g key={l.lane}>
            <text x={10} y={l.top + LANE_PAD + 13} className={styles.laneTitle}>
              {laneTitles[l.lane]}
            </text>
            <text x={10} y={l.top + LANE_PAD + 26} className={styles.laneCount}>
              {l.count}
            </text>
            {l.placed.map((p) => renderItem(p, l.lane, l.top))}
          </g>
        ))}

        <line x1={anchorX} y1={22} x2={anchorX} y2={bodyBottom} className={styles.anchorLine} />
        <text
          x={anchorFlagLeft ? anchorX - 6 : anchorX + 6}
          y={34}
          textAnchor={anchorFlagLeft ? "end" : "start"}
          className={styles.anchorLabel}
        >
          {anchorYear} · {t(S.eventFrieze.anchor)}
        </text>
      </svg>
    </div>
  );
}
