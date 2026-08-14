import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import type { Bi } from "../../i18n/strings";
import { Num } from "../table/Num";
import styles from "./Toolbar.module.css";
import type { ScenarioMode, ToolbarState } from "./useToolbarState";

export interface ToolbarProps {
  value: ToolbarState;
  onChange: (next: ToolbarState) => void;
  onRun: () => void;
  onCopyPermalink?: () => void;
}

const MODES: { key: ScenarioMode; label: Bi }[] = [
  { key: "anchor", label: S.toolbar.modeAnchor },
  { key: "manual", label: S.toolbar.modeManual },
  { key: "shock", label: S.toolbar.modeShock },
];

const ALL_HORIZONS = [1, 3, 5, 10];

/** §11.2 : barre d'outils du scénario, toujours visible sous la barre de titre. */
export function Toolbar({ value, onChange, onRun, onCopyPermalink }: ToolbarProps) {
  const { t } = useLanguage();
  return (
    <div className={styles.bar}>
      <div className={styles.segmented} role="tablist" aria-label={t(S.toolbar.modeAriaLabel)}>
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={styles.segmentedBtn}
            data-active={value.mode === m.key}
            onClick={() => onChange({ ...value, mode: m.key })}
          >
            {t(m.label)}
          </button>
        ))}
      </div>

      <div className={styles.group}>
        <span className={styles.label}>{t(S.toolbar.k)}</span>
        <input
          className={styles.numInput}
          type="number"
          min={1}
          max={100}
          value={value.k}
          onChange={(e) => onChange({ ...value, k: Number(e.target.value) })}
        />
      </div>

      <div className={styles.group}>
        <span className={styles.label}>{t(S.toolbar.horizons)}</span>
        {ALL_HORIZONS.map((h) => {
          const active = value.horizons.includes(h);
          return (
            <button
              key={h}
              type="button"
              className={styles.chip}
              data-active={active}
              onClick={() =>
                onChange({
                  ...value,
                  horizons: active
                    ? value.horizons.filter((x) => x !== h)
                    : [...value.horizons, h].sort((a, b) => a - b),
                })
              }
            >
              <Num value={h} decimals={0} />
            </button>
          );
        })}
      </div>

      <div className={styles.group}>
        <span className={styles.label}>{t(S.toolbar.metric)}</span>
        <select
          className={styles.select}
          value={value.metric}
          onChange={(e) => onChange({ ...value, metric: e.target.value as "euclidean" })}
        >
          <option value="euclidean">{t(S.toolbar.metricEuclidean)}</option>
        </select>
      </div>

      <div className={styles.spacer} />

      {onCopyPermalink && (
        <button
          type="button"
          className={styles.runBtn}
          onClick={onCopyPermalink}
          title={t(S.toolbar.copyPermalinkTitle)}
        >
          {t(S.toolbar.copyPermalink)}
        </button>
      )}
      <button type="button" className={styles.runBtn} onClick={onRun} title={t(S.toolbar.runTitle)}>
        {t(S.toolbar.run)}
      </button>
    </div>
  );
}
