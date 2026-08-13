import type { EventOut } from "../../api/types";
import styles from "./EventFrieze.module.css";

export interface EventFriezeProps {
  events: EventOut[];
  anchorYear: number;
  rangeStart: number;
  rangeEnd: number;
}

/** §11.2 « Frise d'événements » — bandes pour les événements à plage
 * (guerres, régimes), repère pour les événements ponctuels (crises). */
export function EventFrieze({ events, anchorYear, rangeStart, rangeEnd }: EventFriezeProps) {
  const width = 900;
  const rowHeight = 16;
  const padding = 24;
  const usableWidth = width - padding * 2;
  const height = padding + events.length * rowHeight + 20;

  function xFor(year: number): number {
    const t = (year - rangeStart) / (rangeEnd - rangeStart || 1);
    return padding + Math.max(0, Math.min(1, t)) * usableWidth;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>Frise d'événements</div>
      {events.length === 0 ? (
        <div className={styles.eventLabel}>Aucun événement recensé sur cette fenêtre.</div>
      ) : (
        <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMin meet">
          <line x1={padding} y1={10} x2={width - padding} y2={10} className={styles.axisLine} />
          <line x1={xFor(anchorYear)} y1={0} x2={xFor(anchorYear)} y2={height} className={styles.anchorLine} />
          {events.map((e, i) => {
            const y = 20 + i * rowHeight;
            const x1 = xFor(new Date(e.date_start).getFullYear());
            const x2 = e.date_end ? xFor(new Date(e.date_end).getFullYear()) : x1 + 3;
            const isCrisis = e.kind === "banking_crisis";
            return (
              <g key={e.id}>
                <rect
                  x={x1}
                  y={y}
                  width={Math.max(2, x2 - x1)}
                  height={10}
                  className={isCrisis ? styles.crisisBand : styles.band}
                />
                <text x={x2 + 4} y={y + 9} className={styles.eventLabel}>
                  {e.label_fr}
                </text>
              </g>
            );
          })}
          <text x={padding} y={height - 4} className={styles.label}>
            {rangeStart}
          </text>
          <text x={width - padding} y={height - 4} textAnchor="end" className={styles.label}>
            {rangeEnd}
          </text>
        </svg>
      )}
    </div>
  );
}
