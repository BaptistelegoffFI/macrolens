import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { INDICATOR_DEFINITION_EN, SOURCE_EN, indicatorDefinition, sourceTexts } from "../src/i18n/dataStrings";

// Les données de référence vivent dans data/reference/ (pas dans l'API ni dans le frontend) : le
// test les lit pour qu'un indicateur ou une source ajouté sans traduction fasse échouer la CI.
const REFERENCE = join(__dirname, "..", "..", "data", "reference");
const ids = (file: string, key: string) =>
  [...readFileSync(join(REFERENCE, file), "utf-8").matchAll(new RegExp(`^- ${key}:\\s*(\\S+)`, "gm"))].map((m) => m[1]);

describe("traductions des données de référence", () => {
  it("chaque indicateur a une définition anglaise", () => {
    const codes = ids("indicators.yaml", "code");
    expect(codes.length).toBeGreaterThan(20);
    for (const code of codes) expect(INDICATOR_DEFINITION_EN[code], `indicateur ${code}`).toBeTruthy();
  });

  it("aucune définition anglaise ne reste en français", () => {
    for (const [code, text] of Object.entries(INDICATOR_DEFINITION_EN)) {
      expect(text, code).not.toMatch(/[àâçéèêëîïôûùü]/i);
      expect(text, code).not.toMatch(/\b(le|la|les|des|du|une|et|pour|rapporté)\b/);
    }
  });

  it("chaque source a une licence anglaise, et aucune n'est en français", () => {
    const sourceIds = ids("sources.yaml", "id");
    expect(sourceIds.length).toBe(16);
    for (const id of sourceIds) {
      const en = SOURCE_EN[id];
      expect(en?.licence, `source ${id}`).toBeTruthy();
      expect(en.licence).not.toMatch(/[àâçéèêëîïôûùü]|\b(avec|réutilisation|usage|données)\b/i);
    }
  });

  it("en français le texte de l'API est rendu tel quel ; en anglais la table prend le relais", () => {
    expect(indicatorDefinition("cpi", "Indice des prix", "fr")).toBe("Indice des prix");
    expect(indicatorDefinition("cpi", "Indice des prix", "en")).toMatch(/^Index measuring/);
    const src = { id: "rr_crises", full_name: "Reinhart & Rogoff — chronologie des crises", citation: "c", licence: "l" };
    expect(sourceTexts(src, "fr")).toEqual({ full_name: src.full_name, citation: "c", licence: "l" });
    expect(sourceTexts(src, "en").full_name).toBe("Reinhart & Rogoff — crisis chronology");
  });

  it("un identifiant inconnu retombe sur le texte de l'API, jamais sur du vide", () => {
    expect(indicatorDefinition("nouveau", "Définition", "en")).toBe("Définition");
    expect(sourceTexts({ id: "nouvelle", full_name: "N", citation: "C", licence: "L" }, "en")).toEqual({
      full_name: "N",
      citation: "C",
      licence: "L",
    });
  });
});
