import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ADR 0030 : le système de conception est une règle vérifiée, pas une intention. Toute feuille de
 * style consomme les jetons de src/styles/tokens.css ; aucune taille de police, graisse,
 * espacement ou couleur n'y est écrit en dur. Ce test est l'équivalent, pour les feuilles CSS, de
 * tests/numeric-rendering.test.ts pour les nombres.
 */
const SRC = join(__dirname, "..", "src");

function collect(dir: string, pattern: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full, pattern));
    else if (pattern.test(entry)) out.push(full);
  }
  return out;
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const cssFiles = collect(SRC, /\.css$/);
const sheets = cssFiles.filter((f) => !f.endsWith("tokens.css"));

interface Declaration {
  prop: string;
  value: string;
}

function declarations(css: string): Declaration[] {
  return [...stripComments(css).matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)].map((m) => ({
    prop: m[1],
    value: m[2].trim(),
  }));
}

describe("design system : feuilles de style", () => {
  it("scanne toutes les feuilles", () => {
    expect(sheets.length).toBeGreaterThan(25);
  });

  it.each(sheets.map((f) => [relative(SRC, f), f]))("%s n'écrit aucune taille, graisse ni famille en dur", (_name, file) => {
    for (const { prop, value } of declarations(readFileSync(file, "utf-8"))) {
      if (prop === "font-size") expect(value, `${prop}: ${value}`).toMatch(/^(var\(--text-[a-z]+\)|inherit)$/);
      if (prop === "font-weight") expect(value, `${prop}: ${value}`).toMatch(/^(var\(--weight-[a-z]+\)|inherit)$/);
      if (prop === "font-family") expect(value, `${prop}: ${value}`).toMatch(/^(var\(--font-(sans|mono)\)|inherit)$/);
      if (prop === "letter-spacing") expect(value, `${prop}: ${value}`).toMatch(/^(var\(--track-[a-z]+\)|0|normal)$/);
    }
  });

  it.each(sheets.map((f) => [relative(SRC, f), f]))("%s : espacements sur l'échelle de 4 px", (_name, file) => {
    const spacing = /^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left))?$/;
    for (const { prop, value } of declarations(readFileSync(file, "utf-8"))) {
      if (!spacing.test(prop)) continue;
      // Tout nombre en px, hors var()/calc() de jetons, doit être un multiple de 4 (ou 0).
      const withoutVars = value.replace(/var\([^)]*\)/g, "").replace(/calc\([^)]*\)/g, "");
      for (const px of withoutVars.matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
        const n = Math.abs(Number(px[1]));
        expect(n % 4, `${prop}: ${value}`).toBe(0);
      }
    }
  });

  it.each(sheets.map((f) => [relative(SRC, f), f]))("%s n'écrit aucune couleur en dur", (_name, file) => {
    for (const { prop, value } of declarations(readFileSync(file, "utf-8"))) {
      if (/^composes$/.test(prop)) continue;
      expect(value, `${prop}: ${value}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(value, `${prop}: ${value}`).not.toMatch(/\brgba?\(/);
    }
  });

  it.each(sheets.map((f) => [relative(SRC, f), f]))("%s : chaque `composes` pointe vers un fichier existant", (_name, file) => {
    const css = stripComments(readFileSync(file, "utf-8"));
    for (const m of css.matchAll(/composes:[^;]*from\s+"([^"]+)"/g)) {
      expect(existsSync(normalize(join(dirname(file), m[1]))), `${m[1]} introuvable`).toBe(true);
    }
  });
});

describe("design system : composes", () => {
  it.each(sheets.map((f) => [relative(SRC, f), f]))("%s : `composes` seulement sur un sélecteur de classe simple", (_name, file) => {
    // CSS Modules refuse `composes` dans « .a th » ou « .a, .b » : le build échouerait alors que les
    // tests unitaires (qui ne compilent pas le CSS) passeraient.
    const css = stripComments(readFileSync(file, "utf-8"));
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/composes\s*:/.test(rule[2])) continue;
      for (const selector of rule[1].split(",")) {
        expect(selector.trim(), `selector avec composes : ${selector.trim()}`).toMatch(/^\.[A-Za-z0-9_]+(\[[^\]]+\])?$/);
      }
    }
  });
});

describe("design system : TSX", () => {
  const files = collect(SRC, /\.tsx$/).filter(
    // Filet d'urgence volontairement sans feuille de style ni contexte (RootFallback).
    (f) => !f.endsWith("RootFallback.tsx"),
  );

  it("aucun composant n'écrit de fontSize ni de couleur hexadécimale en ligne", () => {
    for (const f of files) {
      const code = readFileSync(f, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code, `${relative(SRC, f)} : fontSize en ligne`).not.toMatch(/fontSize\s*:/);
      expect(code, `${relative(SRC, f)} : couleur hex en ligne`).not.toMatch(/["']#[0-9a-fA-F]{3,8}["']/);
    }
  });
});

describe("design system : jetons des graphiques", () => {
  const tokens = readFileSync(join(SRC, "styles", "tokens.css"), "utf-8");
  const theme = readFileSync(join(SRC, "charts", "theme.ts"), "utf-8");
  const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens)?.[1].toLowerCase();

  it("charts/theme.ts reprend exactement les jetons de couleur (ECharts ne lit pas les variables CSS)", () => {
    expect(theme).toContain(`fgMuted: "${token("fg-muted")}"`);
    expect(theme).toContain(`axis: "${token("axis")}"`);
    expect(theme).toContain(`fg: "${token("fg")}"`);
    expect(theme).toContain(`gridChart: "${token("grid-chart")}"`);
    for (const i of [1, 2, 3, 4, 5, 6, 7, 8]) expect(theme.toLowerCase()).toContain(`"${token(`s${i}`)}"`);
  });

  it("la taille minimale de texte de graphique est celle de la métadonnée (10 px)", () => {
    const sizes = [...theme.matchAll(/fontSize:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(10);
  });
});
