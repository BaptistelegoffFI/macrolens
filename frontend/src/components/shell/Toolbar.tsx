import styles from "./Toolbar.module.css";
import type { ScenarioMode, ToolbarState } from "./useToolbarState";

export interface ToolbarProps {
  value: ToolbarState;
  onChange: (next: ToolbarState) => void;
  onRun: () => void;
  onCopyPermalink?: () => void;
}

const MODES: { key: ScenarioMode; label: string }[] = [
  { key: "anchor", label: "Ancre" },
  { key: "manual", label: "Manuel" },
  { key: "shock", label: "Choc" },
];

const ALL_HORIZONS = [1, 3, 5, 10];

/** §11.2 : barre d'outils du scénario, toujours visible sous la barre de menus. */
export function Toolbar({ value, onChange, onRun, onCopyPermalink }: ToolbarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.segmented} role="tablist" aria-label="Mode de recherche">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={styles.segmentedBtn}
            data-active={value.mode === m.key}
            onClick={() => onChange({ ...value, mode: m.key })}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={styles.group}>
        <span className={styles.label}>k</span>
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
        <span className={styles.label}>Horizons</span>
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
              {h}
            </button>
          );
        })}
      </div>

      <div className={styles.group}>
        <span className={styles.label}>Métrique</span>
        <select
          className={styles.select}
          value={value.metric}
          onChange={(e) => onChange({ ...value, metric: e.target.value as "euclidean" })}
        >
          <option value="euclidean">Euclidienne</option>
        </select>
      </div>

      <div className={styles.spacer} />

      {onCopyPermalink && (
        <button
          type="button"
          className={styles.runBtn}
          onClick={onCopyPermalink}
          title="Copier le permalien de la dernière recherche (Ctrl+L)"
        >
          Copier le lien [Ctrl+L]
        </button>
      )}
      <button type="button" className={styles.runBtn} onClick={onRun} title="Rechercher (F5)">
        Rechercher [F5]
      </button>
    </div>
  );
}
