import { describe, expect, it } from "vitest";

import { contrastRatio } from "../src/lib/contrast";

// Miroir de src/styles/tokens.css — §11.8 : contraste AA (4.5:1) exigé sur
// tout texte, y compris le 10px. Test de non-régression : si un jeton de
// texte est de nouveau assombri/éclairci par erreur, ce test le signale.
const BG_APP = "#ffffff";
const TEXT_TOKENS: Record<string, string> = {
  fg: "#16191c",
  "fg-secondary": "#5a6169",
  "fg-muted": "#6b7278",
  pos: "#0b5fa5",
  neg: "#b3242b",
  accent: "#0b5fa5",
};

describe("WCAG AA contrast (§11.8)", () => {
  it.each(Object.entries(TEXT_TOKENS))("%s meets 4.5:1 against --bg-app", (_name, hex) => {
    expect(contrastRatio(hex, BG_APP)).toBeGreaterThanOrEqual(4.5);
  });
});
