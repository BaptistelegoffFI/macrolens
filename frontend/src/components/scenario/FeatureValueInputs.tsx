import styles from "../../App.module.css";
import { featuresByFamily } from "../../lib/features";

export interface FeatureValueInputsProps {
  values: Record<string, number>;
  onChange: (code: string, raw: string) => void;
}

/** Saisie manuelle des 14 features (§10.1, modes "manual"/"shock") — un champ
 * non renseigné n'entre pas dans la requête (pas de 0 fabriqué). */
export function FeatureValueInputs({ values, onChange }: FeatureValueInputsProps) {
  return (
    <>
      {featuresByFamily().map((group) => (
        <div key={group.family} className={styles.fieldGroup}>
          <div className={styles.fieldGroupTitle}>{group.label}</div>
          {group.features.map((f) => (
            <div key={f.code} className={styles.field}>
              <span className={styles.fieldLabel}>{f.label}</span>
              <input
                className={styles.textInput}
                type="number"
                step="0.1"
                placeholder="—"
                value={values[f.code] ?? ""}
                onChange={(e) => onChange(f.code, e.target.value)}
              />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
