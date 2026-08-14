import type { AnalogOut } from "../../api/types";
import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { Num } from "../table/Num";
import styles from "./Timeline.module.css";

export interface TimelineProps {
  analogs: AnalogOut[];
  anchorYear?: number;
  rangeStart?: number;
  rangeEnd?: number;
}

/** §11.2 « Chronologie » : un repère par analogue sur l'axe 1870-présent. */
export function Timeline({ analogs, anchorYear, rangeStart = 1870, rangeEnd = new Date().getFullYear() }: TimelineProps) {
  const { t } = useLanguage();
  const width = 900;
  const height = 60;
  const padding = 24;
  const usableWidth = width - padding * 2;

  function xFor(year: number): number {
    const t = (year - rangeStart) / (rangeEnd - rangeStart);
    return padding + t * usableWidth;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>
        {t(S.timeline.titlePrefix)} <Num value={rangeStart} decimals={0} /> — <Num value={rangeEnd} decimals={0} />
      </div>
      <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMid meet">
        <line x1={padding} y1={30} x2={width - padding} y2={30} className={styles.axisLine} />
        {analogs.map((a) => (
          <line
            key={`${a.country}-${a.year}`}
            x1={xFor(a.year)}
            y1={20}
            x2={xFor(a.year)}
            y2={40}
            className={styles.tick}
          >
            <title>
              {a.country} {a.year}
            </title>
          </line>
        ))}
        {anchorYear !== undefined && (
          <line x1={xFor(anchorYear)} y1={14} x2={xFor(anchorYear)} y2={46} className={styles.tickAnchor}>
            <title>{t(S.timeline.anchorTooltip)(anchorYear)}</title>
          </line>
        )}
        {/* §12.4bis : <Num> rend un <span> HTML, invalide dans <text> SVG —
            exception structurelle documentée, pas un oubli. Le texte SVG
            hérite déjà de la fonte mono via styles.label (chasse fixe
            respectée), seul le composant React n'est pas réutilisable ici. */}
        <text x={padding} y={54} className={styles.label}>
          {rangeStart}
        </text>
        <text x={width - padding} y={54} textAnchor="end" className={styles.label}>
          {rangeEnd}
        </text>
      </svg>
    </div>
  );
}
