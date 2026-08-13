/** §11.3 : `Ctrl+K` exécute directement une requête. Motifs reconnus,
 * tirés de l'exemple du plan : "FRA 2025" (ancre), "SWE 1990 vs FIN 1990"
 * (comparaison). Toute autre saisie est rapportée comme non reconnue —
 * jamais interprétée au hasard. */

export interface AnchorCommand {
  type: "anchor";
  country: string;
  year: number;
}

export interface CompareCommand {
  type: "compare";
  pairs: { country: string; year: number }[];
}

export interface UnknownCommand {
  type: "unknown";
  raw: string;
}

export type ParsedCommand = AnchorCommand | CompareCommand | UnknownCommand;

const PAIR_RE = /^([A-Za-z]{3})\s+(\d{4})$/;

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) return { type: "unknown", raw: input };

  if (/\svs\s/i.test(trimmed)) {
    const parts = trimmed.split(/\s+vs\s+/i).map((p) => p.trim());
    const pairs = parts.map((p) => {
      const m = PAIR_RE.exec(p);
      return m ? { country: m[1].toUpperCase(), year: Number(m[2]) } : null;
    });
    if (pairs.length >= 2 && pairs.every((p) => p !== null)) {
      return { type: "compare", pairs: pairs as { country: string; year: number }[] };
    }
    return { type: "unknown", raw: input };
  }

  const m = PAIR_RE.exec(trimmed);
  if (m) {
    return { type: "anchor", country: m[1].toUpperCase(), year: Number(m[2]) };
  }

  return { type: "unknown", raw: input };
}
