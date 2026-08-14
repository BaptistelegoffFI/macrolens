import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { LanguageProvider } from "../src/i18n/LanguageContext";

// jsdom n'a pas de vrai moteur canvas : on ne teste pas le rendu interne
// d'ECharts ici (couvert visuellement dans le navigateur), seulement le
// câblage recherche -> tableau/barre d'état, donc echarts.init est stubbé.
vi.mock("echarts", () => ({
  init: () => ({
    setOption: () => {},
    resize: () => {},
    dispose: () => {},
  }),
}));

const MOCK_RESPONSE = {
  build_id: "test-build",
  query_echo: {},
  pool_size: 100,
  excluded: { incomplete: 1, self_adjacent: 0, too_recent: 0, breaks: 0, partial_coverage: 0, user_excluded: 0 },
  analogs: [
    {
      country: "SWE",
      year: 1990,
      distance: 0.1,
      similarity: 90,
      feature_contributions: {},
      state: [],
      context_events: [],
      outcomes: { "3": { out_growth_cum: -4.2, out_banking_crisis: true } },
    },
  ],
  aggregates: {},
  concentration: { hhi_country: 0.2, hhi_decade: 0.3, n_countries: 1, n_decades: 1 },
  warnings: [],
  sources_summary: [{ id: "jst", citation: "c", url: "u", licence: "l" }],
};

describe("Scenario view — analogs search wiring", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => MOCK_RESPONSE,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs a search and renders the analogs table with real data", async () => {
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Rechercher/ }));

    await waitFor(() => expect(screen.getByText("SWE")).toBeInTheDocument());
    expect(screen.getByText("1990")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("build test-build");
    expect(screen.getByRole("status")).toHaveTextContent("n=1");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/analogs/search"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
