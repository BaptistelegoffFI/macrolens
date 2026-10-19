import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "../src/lib/contrast";

// §11.8 : contraste AA (4,5:1) exigé sur tout texte, y compris à 10 px, sur TOUTES les surfaces où
// il peut apparaître. Les jetons sont lus dans src/styles/tokens.css (et non recopiés ici) : toute
// retouche d'un jeton qui ferait passer une paire sous le seuil fait échouer ce test.
const tokensCss = readFileSync(join(__dirname, "..", "src", "styles", "tokens.css"), "utf-8");
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokensCss);
  if (!m) throw new Error(`jeton --${name} introuvable`);
  return m[1];
};

const TEXT = ["fg", "fg-secondary", "fg-muted", "pos", "neg", "accent", "crisis", "flag"] as const;
const SURFACES = ["bg-app", "bg-chrome", "bg-row-alt", "bg-selected", "bg-hover"] as const;

describe("WCAG AA contrast (§11.8)", () => {
  const pairs = TEXT.flatMap((fg) => SURFACES.map((bg) => [fg, bg] as const));

  it.each(pairs)("--%s sur --%s atteint 4,5:1", (fg, bg) => {
    expect(contrastRatio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("les graduations de graphique (non textuelles) atteignent 3:1 sur le fond de travail", () => {
    expect(contrastRatio(token("axis"), token("bg-app"))).toBeGreaterThanOrEqual(3);
  });

  it("le gris de métadonnée reste plus discret que le gris de libellé", () => {
    expect(contrastRatio(token("fg-muted"), token("bg-app"))).toBeLessThan(
      contrastRatio(token("fg-secondary"), token("bg-app")),
    );
  });
});
