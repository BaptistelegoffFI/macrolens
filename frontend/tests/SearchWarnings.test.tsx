import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SearchWarnings } from "../src/components/scenario/SearchWarnings";
import { LanguageProvider } from "../src/i18n/LanguageContext";

const EPOCH = (n: number) =>
  `Analogue distant de ${n} ans. Le rapprochement porte sur des positions relatives, pas sur des niveaux comparables. Structures économiques très différentes.`;
const HHI =
  "Indice de concentration élevé (HHI pays=0.13, HHI décennie=0.51) : plusieurs analogues peuvent appartenir au même épisode historique.";

const renderIn = (lang: "fr" | "en", warnings: string[] | null) => {
  localStorage.setItem("ml.lang", lang);
  return render(
    <LanguageProvider>
      <SearchWarnings warnings={warnings} />
    </LanguageProvider>,
  );
};

afterEach(() => localStorage.clear());

describe("avertissements de recherche : colonne de droite", () => {
  it("en français : une seule carte pour les analogues distants, avec l'écart", () => {
    renderIn("fr", [EPOCH(67), EPOCH(68), EPOCH(94), HHI]);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Analogues éloignés dans le temps")).toBeInTheDocument();
    expect(screen.getByText("3 analogues sont distants de 67 à 94 ans de la requête.")).toBeInTheDocument();
    expect(screen.getByText(/pas sur des niveaux comparables/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Indice de concentration élevé (HHI pays = 0.13, HHI décennie = 0.51) : plusieurs analogues peuvent appartenir au même épisode historique.",
      ),
    ).toBeInTheDocument();
  });

  it("en anglais : tout est traduit, aucune phrase française ne reste", () => {
    renderIn("en", [EPOCH(67), EPOCH(94), HHI]);
    expect(screen.getByText("Analogues far apart in time")).toBeInTheDocument();
    expect(screen.getByText("2 analogues are 67 to 94 years from the query.")).toBeInTheDocument();
    expect(screen.getByText("High concentration")).toBeInTheDocument();
    expect(
      screen.getByText(
        "High concentration index (country HHI = 0.13, decade HHI = 0.51): several analogues may belong to the same historical episode.",
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Analogue distant|décennie|requête/);
  });

  it("accorde le singulier : un seul analogue éloigné", () => {
    renderIn("en", [EPOCH(71)]);
    expect(screen.getByText("The analogue is 71 years from the query.")).toBeInTheDocument();
  });

  it("dit explicitement qu'il n'y a aucun avertissement, et invite à lancer une recherche avant", () => {
    const { unmount } = renderIn("fr", []);
    expect(screen.getByText("Aucun avertissement pour cette recherche.")).toBeInTheDocument();
    unmount();
    renderIn("fr", null);
    expect(screen.getByText(/Lancez une recherche/)).toBeInTheDocument();
  });

  it("garde une phrase inconnue telle quelle", () => {
    renderIn("en", ["Nouvel avertissement."]);
    expect(screen.getByText("Nouvel avertissement.")).toBeInTheDocument();
  });
});
