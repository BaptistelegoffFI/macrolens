import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../src/i18n/LanguageContext";
import { SeriesExplorerView } from "../src/views/SeriesExplorerView";
import { COUNTRY_FIXTURE } from "./fixtures/assetReturns";

vi.mock("echarts", () => ({
  init: () => ({ setOption: () => {}, resize: () => {}, dispose: () => {}, getDataURL: () => "" }),
}));

const COUNTRIES = ["FRA", "DEU", "ITA", "SWE", "FIN", "NOR"].map((iso3) => ({
  iso3, name_fr: iso3, name_en: iso3, is_core: true, in_analog_pool: true, year_min: 1870, year_max: 2020, n_observations: 1,
}));
const INDICATORS = [
  { code: "cpi", label_fr: "Indice des prix", label_en: "Consumer price index", family: "prices", unit: "index", is_derived: false, derivation: null, higher_is_worse: null, definition_fr: "x" },
];
const OBS = [
  { country_iso3: "FRA", indicator_code: "cpi", period_start: "2000-01-01", freq: "A", value: 100, source_id: "jst", is_interpolated: false, is_spliced: false, is_break: false, conflict: false, coverage_partial: false },
  { country_iso3: "FRA", indicator_code: "cpi", period_start: "2001-01-01", freq: "A", value: 102, source_id: "jst", is_interpolated: false, is_spliced: false, is_break: false, conflict: false, coverage_partial: false },
];

function install(assetBehaviour: "ok" | "fail") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/asset-classes")) {
        if (assetBehaviour === "fail") throw new Error("asset endpoint down");
        return { ok: true, json: async () => COUNTRY_FIXTURE };
      }
      if (url.includes("/meta/countries")) return { ok: true, json: async () => COUNTRIES };
      if (url.includes("/meta/indicators")) return { ok: true, json: async () => INDICATORS };
      return { ok: true, json: async () => OBS };
    }),
  );
}

const urls = () => vi.mocked(fetch).mock.calls.map((c) => String(c[0]));

function renderExplorer() {
  render(
    <LanguageProvider>
      <SeriesExplorerView />
    </LanguageProvider>,
  );
}

describe("SeriesExplorerView with asset overlays", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("does not call the asset endpoint when only a macro series is selected (existing behaviour)", async () => {
    install("ok");
    renderExplorer();
    await waitFor(() => expect(urls().some((u) => u.includes("/series?"))).toBe(true));
    expect(urls().some((u) => u.includes("/asset-classes"))).toBe(false);
  });

  it("offers asset classes as a group next to the macro series, in the primary selector", async () => {
    install("ok");
    renderExplorer();
    const select = (await screen.findAllByRole("combobox"))[0];
    expect(select.querySelectorAll("optgroup")).toHaveLength(2);
    expect(await screen.findByRole("option", { name: "Actions, rendement réel annuel" })).toBeInTheDocument();
  });

  it("overlays an asset series on the macro one, one request per selected country", async () => {
    install("ok");
    renderExplorer();
    await screen.findByText(/Superposer des séries/);
    await userEvent.click(await screen.findByRole("checkbox", { name: /Actions, rendement réel annuel/ }));
    await waitFor(() => expect(urls().filter((u) => u.includes("/asset-classes"))).toHaveLength(6));
    expect(screen.getByText("Indice des prix + Actions, rendement réel annuel")).toBeInTheDocument();
  });

  it("recommends the standardized scale when units are mixed and applies it on click", async () => {
    install("ok");
    renderExplorer();
    await userEvent.click(await screen.findByRole("checkbox", { name: /Actions, rendement réel annuel/ }));
    expect(await screen.findByText(/Unités différentes/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Centrer-réduire" }));
    expect(screen.getByRole("button", { name: "Centré-réduit (z)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/Unités différentes/)).not.toBeInTheDocument();
  });

  it("keeps the macro series when the asset endpoint fails, with a non-blocking note", async () => {
    install("fail");
    renderExplorer();
    await userEvent.click(await screen.findByRole("checkbox", { name: /Actions, rendement réel annuel/ }));
    expect(await screen.findByText(/Séries d'actifs indisponibles pour l'instant/)).toBeInTheDocument();
    expect(screen.getByText("Indice des prix + Actions, rendement réel annuel")).toBeInTheDocument();
    expect(screen.getAllByRole("row").length).toBeGreaterThan(0);
  });
});
