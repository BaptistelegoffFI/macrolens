import type { AnalogOut } from "../../api/types";
import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { useElementWidth } from "../../hooks/useElementWidth";
import { Num } from "../table/Num";
import { ChartFrame } from "./ChartFrame";
import styles from "./Timeline.module.css";

export interface TimelineProps {
  analogs: AnalogOut[];
  anchorYear?: number;
  rangeStart?: number;
  rangeEnd?: number;
}

/** §11.2 « Chronologie » : un repère par analogue sur l'axe 1870-présent. Le SVG est dessiné à la
 * largeur réelle de son conteneur (les graduations ne grossissent pas avec l'écran). */
export function Timeline({ analogs, anchorYear, rangeStart = 1870, rangeEnd = new Date().getFullYear() }: TimelineProps) {
  const { t } = useLanguage();
  const { ref, width } = useElementWidth<HTMLDivElement>(900);
  const height = 56;
  const padding = 24;
  const usableWidth = Math.max(0, width - padding * 2);

  function xFor(year: number): number {
    const frac = (year - rangeStart) / (rangeEnd - rangeStart);
    return padding + frac * usableWidth;
  }

  return (
    <ChartFrame
      title={
        <>
          {t(S.timeline.titlePrefix)} <Num value={rangeStart} decimals={0} size="meta" /> —{" "}
          <Num value={rangeEnd} decimals={0} size="meta" />
        </>
      }
    >
      <div ref={ref}>
        <svg className={styles.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <line x1={padding} y1={26} x2={width - padding} y2={26} className={styles.axisLine} />
          {analogs.map((a) => (
            <line
              key={`${a.country}-${a.year}`}
              x1={xFor(a.year)}
              y1={18}
              x2={xFor(a.year)}
              y2={34}
              className={styles.tick}
            >
              <title>
                {a.country} {a.year}
              </title>
            </line>
          ))}
          {anchorYear !== undefined && (
            <line x1={xFor(anchorYear)} y1={10} x2={xFor(anchorYear)} y2={42} className={styles.tickAnchor}>
              <title>{t(S.timeline.anchorTooltip)(anchorYear)}</title>
            </line>
          )}
          {/* §12.4bis : <Num> rend un <span> HTML, invalide dans <text> SVG — exception structurelle
              documentée, pas un oubli. Le texte SVG est en mono via styles.label. */}
          <text x={padding} y={52} className={styles.label}>
            {rangeStart}
          </text>
          <text x={width - padding} y={52} textAnchor="end" className={styles.label}>
            {rangeEnd}
          </text>
        </svg>
      </div>
    </ChartFrame>
  );
}
