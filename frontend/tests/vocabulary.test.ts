import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// §11.7/§12.4 : vocabulaire prédictif interdit dans toute chaîne visible à
// l'utilisateur. Les commentaires expliquant la règle elle-même (ex. "jamais
// une prédiction, règle 4") sont légitimes et donc retirés avant l'analyse —
// seul le code/JSX réellement livré à l'écran est vérifié.
const FORBIDDEN = [
  /prévision/i,
  /prevision/i,
  /prédiction/i,
  /prediction/i,
  /probabilité que/i,
  /probabilite que/i,
  /\battendu\b/i,
  /forecast/i,
  /expected value/i,
];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(tsx?|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("Vocabulaire interdit (§12.4)", () => {
  const srcDir = join(__dirname, "..", "src");
  const files = collectSourceFiles(srcDir);

  it("scans a non-trivial number of source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)("%s carries no forbidden predictive vocabulary", (file) => {
    const code = stripComments(readFileSync(file, "utf-8"));
    for (const pattern of FORBIDDEN) {
      expect(code, `${file} matched ${pattern}`).not.toMatch(pattern);
    }
  });
});
