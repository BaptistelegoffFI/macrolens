import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../src/i18n/LanguageContext";
import { AssetClassesView } from "../src/views/AssetClassesView";
import { CoverageView } from "../src/views/CoverageView";
import { EpisodeView } from "../src/views/EpisodeView";
import { SourcesView } from "../src/views/SourcesView";
import { COUNTRY_FIXTURE } from "./fixtures/assetReturns";

vi.mock("echarts", () => ({
  init: () => ({ setOption: () => {}, resize: () => {}, dispose: () => {}, getDataURL: () => "" }),
}));

function route(handler: (url: string) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => ({ ok: true, status: 200, json: async () => handler(String(input)) })),
  );
}

const withLang = (lang: "fr" | "en", ui: React.ReactNode) => {
  localStorage.setItem("ml.lang", lang);
  return render(<LanguageProvider>{ui}</LanguageProvider>);
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const SOURCES = [
  { id: "jst", full_name: "Jordà-Schularick-Taylor Macrohistory Database", url: "https://www.macrohistory.net/", citation: "Release 6 (2022), 18 économies avancées depuis 1870.", licence: "Usage non commercial, attribution obligatoire, partage à l'identique (CC BY-NC-SA).", priority: 100, retrieved_at: "2026-08-12", file_sha256: "b0ebb74a8d1bdeadbeef", notes: null },
  { id: "bis_pp", full_name: "BIS — Property prices statistics", url: "https://www.bis.org/", citation: "Bank for International Settlements, Property price statistics.", licence: "Réutilisation avec attribution, conditions BIS Data Portal.", priority: 80, retrieved_at: "2026-08-12", file_sha256: null, notes: null },
  { id: "events_manual", full_name: "Fichiers YAML du dépôt — événements curés manuellement", url: "https://example.org/", citation: "Curation interne MacroLens.", licence: "N/A — curation interne, pas de données tierces redistribuées.", priority: 0, retrieved_at: "2026-08-12", file_sha256: null, notes: null },
];

describe("page Sources : langue et hiérarchie", () => {
  it("en anglais, aucune licence ni citation française ne reste", async () => {
    route(() => SOURCES);
    withLang("en", <SourcesView />);
    expect(await screen.findByText("Non-commercial use, attribution required, share-alike (CC BY-NC-SA).")).toBeInTheDocument();
    expect(screen.getByText("Reuse with attribution, BIS Data Portal terms.")).toBeInTheDocument();
    expect(screen.getByText("Repository YAML files — manually curated events")).toBeInTheDocument();
    expect(screen.getByText(/18 advanced economies since 1870/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Usage non commercial|Réutilisation|économies|curés/);
  });

  it("en français, le texte de la base est rendu tel quel", async () => {
    route(() => SOURCES);
    withLang("fr", <SourcesView />);
    expect(await screen.findByText(/Usage non commercial, attribution obligatoire/)).toBeInTheDocument();
  });

  it("regroupe les sources par priorité : primaires, complémentaires, appui", async () => {
    route(() => SOURCES);
    withLang("en", <SourcesView />);
    await screen.findByText(/Jordà-Schularick-Taylor/);
    const primary = screen.getByRole("heading", { level: 3, name: "Primary sources" }).closest("section") as HTMLElement;
    const complementary = screen.getByRole("heading", { level: 3, name: "Complementary sources" }).closest("section") as HTMLElement;
    const supporting = screen.getByRole("heading", { level: 3, name: "Reference and supporting" }).closest("section") as HTMLElement;
    expect(within(primary).getByText(/Jordà-Schularick-Taylor/)).toBeInTheDocument();
    expect(within(complementary).getByText(/Property prices/)).toBeInTheDocument();
    expect(within(supporting).getByText(/manually curated events/)).toBeInTheDocument();
    // Rien n'est retiré : les trois sources et leurs priorités restent affichées.
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
});

describe("page Couverture : infobulles traduites", () => {
  const COVERAGE = (url: string) => {
    if (url.includes("/meta/countries")) return [{ iso3: "FRA", name_fr: "France", name_en: "France", is_core: true, in_analog_pool: true, year_min: 1870, year_max: 2020, n_observations: 1 }];
    if (url.includes("/meta/indicators"))
      return [{ code: "cpi", label_fr: "Indice des prix", label_en: "Consumer price index", family: "prices", unit: "index", is_derived: false, derivation: null, higher_is_worse: null, definition_fr: "Indice mesurant l'évolution du niveau général des prix." }];
    return [{ country_iso3: "FRA", indicator_code: "cpi", decade: 1990, n_observed: 10, n_possible: 10, pct: 100 }];
  };

  it("la définition d'un indicateur suit la langue", async () => {
    route(COVERAGE);
    const { unmount } = withLang("en", <CoverageView />);
    expect((await screen.findByText("Consumer price index")).closest("th")).toHaveAttribute("title", expect.stringMatching(/^Index measuring the change/));
    unmount();
    withLang("fr", <CoverageView />);
    expect((await screen.findByText("Indice des prix")).closest("th")).toHaveAttribute("title", "Indice mesurant l'évolution du niveau général des prix.");
  });
});

describe("page Classes d'actifs : lisibilité", () => {
  const route2 = () =>
    route((url) =>
      url.includes("/meta/countries")
        ? [{ iso3: "USA", name_fr: "États-Unis", name_en: "United States", is_core: false, in_analog_pool: true, year_min: 1870, year_max: 2020, n_observations: 1 }]
        : COUNTRY_FIXTURE,
    );

  it("un groupe entièrement non ingéré dit pourquoi au lieu de paraître vide", async () => {
    route2();
    withLang("en", <AssetClassesView prefill={null} />);
    const row = (await screen.findByRole("rowheader", { name: /By sector/ })).closest("tr") as HTMLElement;
    expect(within(row).getByText("1 series not available (tiers 2 and 3, not ingested)")).toBeInTheDocument();
  });

  it("l'exclusion du capital-investissement est un énoncé, pas une ligne de pied de page", async () => {
    route2();
    withLang("en", <AssetClassesView prefill={null} />);
    const header = await screen.findByRole("rowheader", { name: /Private equity/ });
    expect(within(header).getByText("excluded")).toBeInTheDocument();
    expect(within(header).getByText("Deliberately excluded.")).toBeInTheDocument();
    // Pleine largeur de ligne, hors des colonnes de données.
    expect(header).toHaveAttribute("colspan", "6");
  });

  it("la légende des badges de tier est visible sur la page", async () => {
    route2();
    withLang("en", <AssetClassesView prefill={null} />);
    expect(await screen.findByText(/T1 = tier 1: JST series, 1870 to 2020/)).toBeInTheDocument();
  });
});

describe("page Épisode : plein écran", () => {
  const SERIES = Array.from({ length: 21 }, (_, i) => ({
    country_iso3: "SWE", indicator_code: "cpi", period_start: `${1981 + i}-01-01`, freq: "A", value: 100 + i, unit: "index",
  }));
  const episode = (url: string) => {
    if (url.includes("/episodes/")) return { country: "SWE", year: 1991, state: null, series: { cpi: SERIES, gdp_real_pc: SERIES }, events: [], sources: [] };
    return [];
  };

  it("« Plein écran » ouvre le graphique dans une boîte de dialogue que Échap ferme", async () => {
    route(episode);
    withLang("fr", <EpisodeView initialCountry="SWE" initialYear={1991} />);
    const buttons = await screen.findAllByRole("button", { name: "Plein écran" });
    expect(buttons.length).toBeGreaterThan(5);
    await userEvent.click(buttons[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("page Séries : contrôles en barre", () => {
  it("les séries superposées sont dans un bloc replié par défaut, avec leur nombre", async () => {
    route((url) => {
      if (url.includes("/meta/countries")) return [{ iso3: "FRA", name_fr: "France", name_en: "France", is_core: true, in_analog_pool: true, year_min: 1870, year_max: 2020, n_observations: 1 }];
      if (url.includes("/meta/indicators"))
        return [{ code: "cpi", label_fr: "Indice des prix", label_en: "Consumer price index", family: "prices", unit: "index", is_derived: false, derivation: null, higher_is_worse: null, definition_fr: "d" }];
      return [];
    });
    const { SeriesExplorerView } = await import("../src/views/SeriesExplorerView");
    withLang("en", <SeriesExplorerView />);
    const summary = await screen.findByText(/Overlay series \(0\)/);
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    // Les pays sont des puces à bascule dont le nom complet reste accessible.
    const chip = await screen.findByRole("button", { name: "FRA — France" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });
});
