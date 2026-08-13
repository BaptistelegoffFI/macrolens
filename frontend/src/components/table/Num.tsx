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
}

export function Num({ value, decimals = 1, unit, sign = false, tone = "none" }: NumProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className="num" style={{ color: "var(--fg-muted)" }}>
        —
      </span>
    );
  }

  const resolvedTone = tone === "auto" ? (value < 0 ? "neg" : "pos") : tone;
  const toneColor =
    resolvedTone === "neg" ? "var(--neg)" : resolvedTone === "pos" ? "var(--pos)" : undefined;
  const formatted = `${sign && value >= 0 ? "+" : ""}${value.toFixed(decimals)}${unit ?? ""}`;

  return (
    <span className="num" style={{ color: toneColor }}>
      {formatted}
    </span>
  );
}
