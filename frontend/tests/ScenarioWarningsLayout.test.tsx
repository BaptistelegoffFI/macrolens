import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { LanguageProvider } from "../src/i18n/LanguageContext";

vi.mock("echarts", () => ({
  init: () => ({ setOption: () => {}, resize: () => {}, dispose: () => {} }),
}));

const EPOCH = (n: number) =>
  `Analogue distant de ${n} ans. Le rapprochement porte sur des positions relatives, pas sur des niveaux comparables. Structures économiques très différentes.`;

const analog = (country: string, year: number) => ({
  country,
  year,
  distance: 0.1,
  similarity: 90,
  feature_contributions: {},
  state: [],
  context_events: [],
  outcomes: { "3": { out_growth_cum: -4.2, out_banking_crisis: false } },
});

const SEARCH = {
  build_id: "b",
  query_echo: { mode: "anchor", anchor: { country: "FRA", year: 2019 }, reference_frame: "rolling30" },
  pool_size: 10,
  excluded: {},
  analogs: [analog("DNK", 2000), analog("FRA", 2007)],
  aggregates: {},
  concentration: { hhi_country: 0.13, hhi_decade: 0.51, n_countries: 5, n_decades: 5 },
  warnings: [EPOCH(67), EPOCH(94)],
  sources_summary: [{ id: "jst", citation: "c", url: "u", licence: "l" }],
};

function panel(title: string): HTMLElement {
  const header = screen.getByText(title, { selector: "span" });
  return header.parentElement!.parentElement!;
}

describe("Scénario : avertissements et rendements d'actifs", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) =>
        String(url).includes("/analogs/search")
          ? { ok: true, status: 200, json: async () => SEARCH }
          : { ok: false, status: 404, json: async () => ({ detail: "n/a" }) },
      ),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderApp = () =>
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );

  it("place les avertissements dans la colonne de droite, au-dessus de la provenance, pas dans le tableau", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Rechercher/ }));
    await waitFor(() => expect(screen.getByText("DNK")).toBeInTheDocument());

    const warnings = panel("Avertissements");
    expect(
      within(warnings).getByText("2 analogues sont distants de 67 à 94 ans de la requête."),
    ).toBeInTheDocument();
    // Le tableau des analogues ne contient plus aucun avertissement.
    const analogs = panel("Analogues");
    expect(within(analogs).queryByText(/distants de|⚑/)).toBeNull();
    expect(analogs.textContent).not.toMatch(/Analogue distant de/);

    // Même colonne (chaque panneau est dans une rangée du même empilement), avertissements
    // au-dessus de la provenance, et ce bloc est distinct du panneau des analogues.
    const provenance = panel("Bordereau");
    const stack = warnings.parentElement!.parentElement!.parentElement!;
    expect(provenance.parentElement!.parentElement!.parentElement).toBe(stack);
    expect(stack.contains(analogs)).toBe(false);
    expect(
      warnings.compareDocumentPosition(provenance) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("affiche les avertissements en anglais quand la langue est l'anglais", async () => {
    localStorage.setItem("ml.lang", "en");
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Search/ }));
    await waitFor(() => expect(screen.getByText("DNK")).toBeInTheDocument());
    expect(
      within(panel("Warnings")).getByText("2 analogues are 67 to 94 years from the query."),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Analogue distant/);
  });

  it("met le bloc des rendements d'actifs sous le graphique en éventail, hors des rangées redimensionnables", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Rechercher/ }));
    await waitFor(() => expect(screen.getByText("DNK")).toBeInTheDocument());
    // Le graphique en éventail est dessiné par ECharts (simulé ici) : son pied, avec le bouton
    // d'export, est son repère dans le DOM.
    const fan = within(panel("Analogues")).getAllByRole("button", { name: /PNG/ })[0];
    const assets = screen.getByText(/Ce qui s'est produit pour les actifs/);
    expect(fan.compareDocumentPosition(assets) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Pas dans une rangée à hauteur fixe : le bloc garde sa hauteur naturelle.
    expect(assets.closest('[role="separator"]')).toBeNull();
    const fixedRow = assets.closest("div[style*='height']");
    expect(fixedRow).toBeNull();
  });
});
