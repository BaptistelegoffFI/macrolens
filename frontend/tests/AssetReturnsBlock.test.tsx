import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetReturnsBlock } from "../src/components/scenario/AssetReturnsBlock";
import { FailSafe } from "../src/components/shell/FailSafe";
import { LanguageProvider } from "../src/i18n/LanguageContext";
import { ASSET_RETURNS_FIXTURE } from "./fixtures/assetReturns";

vi.mock("echarts", () => ({
  init: () => ({ setOption: () => {}, resize: () => {}, dispose: () => {} }),
}));

const ANALOGS = [
  { country: "USA", year: 1929 },
  { country: "JPN", year: 1989 },
];

function mockFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

function renderBlock(onOpen = vi.fn()) {
  render(
    <LanguageProvider>
      <AssetReturnsBlock analogs={ANALOGS} anchor={{ country: "FRA", year: 2019 }} onOpenAssetClasses={onOpen} />
    </LanguageProvider>,
  );
  return onOpen;
}

describe("AssetReturnsBlock", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("renders nothing without analogues", () => {
    const { container } = render(
      <LanguageProvider>
        <AssetReturnsBlock analogs={null} anchor={null} onOpenAssetClasses={() => {}} />
      </LanguageProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("posts the analogues returned by the search and renders every class with its tier", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    renderBlock();
    await screen.findByRole("rowheader", { name: /Actions/ });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/scenario/asset-returns"),
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.analogs).toEqual(ANALOGS);
    expect(body.horizons).toEqual([1, 3, 5, 10]);
    for (const label of ["Actions", "Obligations d'État", "Liquidités", "Immobilier résidentiel", "Change contre USD", "Inflation"]) {
      expect(screen.getByRole("rowheader", { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getAllByTitle(/Tier 1/).length).toBeGreaterThanOrEqual(6);
  });

  it("shows median, interquartile range, N and the positive count in a cell", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    renderBlock();
    const row = (await screen.findByRole("rowheader", { name: /Obligations/ })).closest("tr") as HTMLElement;
    const cells = within(row).getAllByRole("cell");
    expect(cells).toHaveLength(3);
    expect(within(cells[0]).getByText("-15.8%")).toBeInTheDocument();
    expect(within(cells[0]).getByText(/Q1 à Q3/)).toBeInTheDocument();
    expect(within(cells[0]).getByText("N = 4 sur 5")).toBeInTheDocument();
    expect(within(cells[0]).getByText("2 sur 4 positifs")).toBeInTheDocument();
  });

  it("says 'not available' with the reason when N is zero, never a zero", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    renderBlock();
    const row = (await screen.findByRole("rowheader", { name: /Actions/ })).closest("tr") as HTMLElement;
    const threeYears = within(row).getAllByRole("cell")[1];
    expect(within(threeYears).getByText("non disponible")).toBeInTheDocument();
    expect(within(threeYears).getByText("N = 0 sur 5")).toBeInTheDocument();
    expect(within(threeYears).getByText(/fenêtre coupée par la fin des données \(5\)/)).toBeInTheDocument();
    expect(within(threeYears).queryByText(/0\.0%/)).not.toBeInTheDocument();
  });

  it("flags extreme episodes without hiding the value", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    renderBlock();
    const row = (await screen.findByRole("rowheader", { name: /Actions/ })).closest("tr") as HTMLElement;
    const oneYear = within(row).getAllByRole("cell")[0];
    expect(within(oneYear).getByTitle("1 épisode extrême inclus")).toBeInTheDocument();
    expect(within(oneYear).getByText("-15.8%")).toBeInTheDocument();
  });

  it("puts housing in its own section with its reliability caveat", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    renderBlock();
    expect(await screen.findByText(/Immobilier : la série la moins fiable du jeu/)).toBeInTheDocument();
    expect(screen.getByText("Série la moins fiable du jeu.")).toBeInTheDocument();
  });

  it("separates FX and inflation and shows the regime pictogram on FX cells", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    renderBlock();
    expect(await screen.findByText(/Change : nominal, séparé du rendement des actifs/)).toBeInTheDocument();
    expect(screen.getByText(/Inflation : variation des prix, nominale/)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /sous étalon-or ou Bretton Woods/ }).length).toBeGreaterThan(0);
  });

  it("switches the displayed measure and says drawdown is a lower bound", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    renderBlock();
    await screen.findByRole("rowheader", { name: /Actions/ });
    await userEvent.click(screen.getByRole("button", { name: "Annualisé" }));
    expect(screen.getAllByText("-5.0%").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Repli maximal" }));
    expect(screen.getAllByText("-30.0%").length).toBeGreaterThan(0);
    expect(screen.getByText(/minorant du repli réel/)).toBeInTheDocument();
  });

  it("labels each curve of the median path chart", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    renderBlock();
    const title = await screen.findByText(/Trajectoire médiane sur 10 ans/);
    const chartBlock = title.parentElement as HTMLElement;
    expect(within(chartBlock).getByText("Actions")).toBeInTheDocument();
    expect(within(chartBlock).getByText("Obligations d'État")).toBeInTheDocument();
  });

  it("shows the provenance line with source, tier, coverage and the no-imputation rule", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    renderBlock();
    expect(await screen.findByText(/Source JST R6, tier 1, 1870 à 2020/)).toBeInTheDocument();
    expect(screen.getByText(/Aucune valeur imputée : N baisse/)).toBeInTheDocument();
  });

  it("links to the asset classes page with the anchor", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    const onOpen = renderBlock();
    await userEvent.click(await screen.findByRole("button", { name: /Classes d'actifs →/ }));
    expect(onOpen).toHaveBeenCalledWith({ country: "FRA", year: 2019 });
  });

  it("renders in English", async () => {
    window.localStorage.setItem("ml.lang", "en");
    mockFetch(async () => ({ ok: true, json: async () => ASSET_RETURNS_FIXTURE }));
    renderBlock();
    expect(await screen.findByRole("rowheader", { name: /Equities/ })).toBeInTheDocument();
    expect(screen.getAllByText("N = 4 of 5").length).toBeGreaterThan(0);
  });

  describe("graceful degradation (4d)", () => {
    it("shows a non-blocking notice when the request fails", async () => {
      mockFetch(async () => Promise.reject(new Error("network down")));
      renderBlock();
      expect(await screen.findByText(/Rendements d'actifs indisponibles/)).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows the notice on an HTTP 503 instead of crashing", async () => {
      mockFetch(async () => ({ ok: false, status: 503, statusText: "x", json: async () => ({ detail: "indisponible" }) }));
      renderBlock();
      expect(await screen.findByText(/Rendements d'actifs indisponibles/)).toBeInTheDocument();
    });

    it("treats a payload of the wrong shape as an error, never passes it to the renderer", async () => {
      mockFetch(async () => ({ ok: true, json: async () => ({ build_id: "x", analogs: [] }) }));
      renderBlock();
      expect(await screen.findByText(/Rendements d'actifs indisponibles/)).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByText(/Chargement/)).not.toBeInTheDocument());
    });

    it("FailSafe replaces only the faulty block after a render error", () => {
      const Boom = () => {
        throw new Error("render failure");
      };
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <div>
          <p>reste de la page</p>
          <FailSafe fallback={<p>bloc isolé</p>}>
            <Boom />
          </FailSafe>
        </div>,
      );
      expect(screen.getByText("bloc isolé")).toBeInTheDocument();
      expect(screen.getByText("reste de la page")).toBeInTheDocument();
      spy.mockRestore();
    });
  });
});
