/**
 * §12.4bis : toute valeur numérique passe obligatoirement par ce
 * composant — chasse fixe tabulaire, décimales fixes, tiret pour valeur
 * manquante. Un nombre écrit en dur ailleurs dans du JSX est un échec de
 * revue (vérifié par tests/numeric-rendering.test.ts — voir ce fichier
 * pour la note sur la règle ESLint dédiée que le plan demande à la place).
 * Le marqueur de flag reste porté par la cellule de tableau qui l'entoure
 * (Table.module.css .tdFlagged), pas par Num, pour éviter un double filet
 * quand Num est utilisé hors tableau (StatusBar, cartes, etc.).
 */
export interface NumProps {
  value: number | null | undefined;
  /** Décimales fixes pour cette valeur — jamais d'arrondi variable d'une
   * ligne à l'autre pour un même indicateur (§11.4). */
  decimals?: number;
  unit?: string;
  /** Préfixe + explicite pour une variation positive (Δ, contributions). */
  sign?: boolean;
  tone?: "pos" | "neg" | "auto" | "none";
  /** Taille : « body » (défaut, valeur), « meta » (IQR, N, fenêtres : la valeur dominante et ses
   * annexes ne partagent jamais la même taille) ou « label » (dans un libellé de contrôle). */
  size?: "body" | "meta" | "label";
}

export function Num({ value, decimals = 1, unit, sign = false, tone = "none", size = "body" }: NumProps) {
  const cls = size === "body" ? "num" : `num num-${size}`;
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className={cls} style={{ color: "var(--fg-muted)" }}>
        —
      </span>
    );
  }

  const resolvedTone = tone === "auto" ? (value < 0 ? "neg" : "pos") : tone;
  const toneColor =
    resolvedTone === "neg" ? "var(--neg)" : resolvedTone === "pos" ? "var(--pos)" : undefined;
  // Au-delà de 10^9 (ex. inflation de l'Allemagne en 1923, +1,06e11 %), tous les chiffres
  // débordent de la cellule sans rien apprendre de plus : notation scientifique.
  const body = Math.abs(value) >= 1e9 ? value.toExponential(2) : value.toFixed(decimals);
  const formatted = `${sign && value >= 0 ? "+" : ""}${body}${unit ?? ""}`;

  return (
    <span className={cls} style={{ color: toneColor }}>
      {formatted}
    </span>
  );
}
