import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../src/i18n/LanguageContext";
import { AssetClassesView } from "../src/views/AssetClassesView";
import { COUNTRY_FIXTURE } from "./fixtures/assetReturns";

const COUNTRIES = [
  { iso3: "USA", name_fr: "États-Unis", name_en: "United States", is_core: false, in_analog_pool: true, year_min: 1870, year_max: 2020, n_observations: 1 },
];

function route(handler: (url: string) => unknown | Promise<unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      const body = await handler(url);
      if (body instanceof Error) throw body;
      return { ok: true, json: async () => body };
    }),
  );
}

const ok = (url: string) => (url.includes("/meta/countries") ? COUNTRIES : COUNTRY_FIXTURE);

function renderView(prefill = null as Parameters<typeof AssetClassesView>[0]["prefill"]) {
  return render(
    <LanguageProvider>
      <AssetClassesView prefill={prefill} />
    </LanguageProvider>,
  );
}

describe("AssetClassesView", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("requests the country and period and shows level, change and annualised for an available row", async () => {
    route(ok);
    renderView({ country: "USA", fromYear: 1929, toYear: 1932, anchorYear: 1931 });
    const row = (await screen.findByRole("rowheader", { name: /Actions/ })).closest("tr") as HTMLElement;
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringMatching(/\/series\/USA\/asset-classes\?from=1929&to=1932/) }),
      expect.anything(),
    );
    expect(within(row).getByText("100.0")).toBeInTheDocument();
    expect(within(row).getByText("48.1")).toBeInTheDocument();
    // -51,9 % : variation réelle cumulée, et repli maximal affiché en dessous de l'annualisé.
    expect(within(row).getAllByText("-51.9%")).toHaveLength(2);
    expect(within(row).getByText("-16.7%")).toBeInTheDocument();
    expect(within(row).getByText("1870 à 2020")).toBeInTheDocument();
    expect(within(row).getByTitle(/Tier 1/)).toHaveTextContent("T1");
  });

  it("shows where the page was pre-filtered from", async () => {
    route(ok);
    renderView({ country: "USA", fromYear: 1929, toYear: 1932, anchorYear: 1931 });
    expect(await screen.findByText("Pré-filtré sur le scénario : USA 1931")).toBeInTheDocument();
  });

  it("switches from real to nominal figures", async () => {
    route(ok);
    renderView();
    const row = (await screen.findByRole("rowheader", { name: /Actions/ })).closest("tr") as HTMLElement;
    await userEvent.click(screen.getByRole("button", { name: "Nominal" }));
    expect(within(row).getByText("38.6")).toBeInTheDocument();
    expect(within(row).getByText("-61.4%")).toBeInTheDocument();
  });

  it("starts with all-unavailable groups collapsed, and expanding reveals each row with its reason", async () => {
    route(ok);
    renderView();
    await screen.findByRole("rowheader", { name: /Actions/ });
    expect(screen.getByRole("rowheader", { name: /Par secteur/ })).toBeInTheDocument();
    expect(screen.queryByRole("rowheader", { name: /Technologie/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Déplier Par secteur/ }));
    const tech = (await screen.findByRole("rowheader", { name: /Technologie/ })).closest("tr") as HTMLElement;
    expect(within(tech).getByText("non disponible")).toBeInTheDocument();
    expect(within(tech).getByText(/Secteurs américains uniquement/)).toBeInTheDocument();
    expect(within(tech).getByTitle(/Tier 3/)).toHaveTextContent("T3");
  });

  it("filters rows by tier", async () => {
    route(ok);
    renderView();
    await screen.findByRole("rowheader", { name: /Actions/ });
    await userEvent.click(screen.getByRole("button", { name: /Déplier Par secteur/ }));
    await screen.findByRole("rowheader", { name: /Technologie/ });
    await userEvent.click(screen.getByRole("button", { name: "T3" }));
    expect(screen.queryByRole("rowheader", { name: /Technologie/ })).not.toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /Actions/ })).toBeInTheDocument();
  });

  it("shows private markets as excluded, with the reason", async () => {
    route(ok);
    renderView();
    const row = (await screen.findByRole("rowheader", { name: /Private equity/ })).closest("tr") as HTMLElement;
    expect(within(row).getByText("exclu")).toBeInTheDocument();
    expect(within(row).getByText("Exclu volontairement.")).toBeInTheDocument();
  });

  it("says 'not available at this date' outside coverage, never zero", async () => {
    const outside = structuredClone(COUNTRY_FIXTURE);
    outside.series[0].summary = { ...outside.series[0].summary, available: false, change: null, level_end: null };
    route((url) => (url.includes("/meta/countries") ? COUNTRIES : outside));
    renderView();
    const row = (await screen.findByRole("rowheader", { name: /Actions/ })).closest("tr") as HTMLElement;
    expect(within(row).getByText("non disponible à cette date")).toBeInTheDocument();
  });

  it("lists a gap in the period instead of computing a change across it", async () => {
    const gappy = structuredClone(COUNTRY_FIXTURE);
    gappy.series[0].summary = {
      ...gappy.series[0].summary,
      gaps: [{ start_year: 1923, end_year: 1923 }],
      change: null,
      annualised: null,
    };
    route((url) => (url.includes("/meta/countries") ? COUNTRIES : gappy));
    renderView();
    expect(await screen.findByText(/trou dans la période \(1923\) : variation non calculée, jamais comblée/)).toBeInTheDocument();
  });

  it("degrades to a notice when the endpoint fails, without throwing", async () => {
    route((url) => (url.includes("/meta/countries") ? COUNTRIES : new Error("down")));
    renderView();
    expect(await screen.findByText(/Rendements d'actifs indisponibles/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("re-requests when the period changes", async () => {
    route(ok);
    renderView({ country: "USA", fromYear: 1929, toYear: 1932, anchorYear: 1931 });
    await screen.findByRole("rowheader", { name: /Actions/ });
    const [from] = screen.getAllByRole("spinbutton");
    await userEvent.clear(from);
    await userEvent.type(from, "1950");
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.objectContaining({ href: expect.stringMatching(/from=1950&to=1932/) }),
        expect.anything(),
      ),
    );
  });
});
