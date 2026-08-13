import styles from "./WeightSlider.module.css";

export interface WeightSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

/** §11.6 : rail 2px + poignée carrée, valeur numérique éditable au clavier. */
export function WeightSlider({ label, value, onChange }: WeightSliderProps) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.rail}>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`Poids ${label}`}
        />
      </div>
      <span className={`${styles.value} num`}>{value.toFixed(2)}</span>
    </div>
  );
}
