import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { LanguageProvider } from "../src/i18n/LanguageContext";

vi.mock("echarts", () => ({
  init: () => ({ setOption: () => {}, resize: () => {}, dispose: () => {} }),
}));

const SEARCH = {
  build_id: "b",
  query_echo: {},
  pool_size: 1,
  excluded: {},
  analogs: [],
  aggregates: {},
  concentration: { hhi_country: 0, hhi_decade: 0, n_countries: 0, n_decades: 0 },
  warnings: [],
  sources_summary: [],
};

function events(): { kind: string; name: string; detail?: string; client_id: string }[] {
  return (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    .filter(([url]) => String(url).includes("/analytics/event"))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

describe("journal d'usage côté application", () => {
  // Seule la recherche reçoit une réponse valide ; le reste répond 404 (les vues dégradent).
  const reply = (searchStatus: number) =>
    vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/analogs/search"))
        return searchStatus === 200
          ? { ok: true, status: 200, json: async () => SEARCH }
          : { ok: false, status: searchStatus, json: async () => ({ detail: "bad" }) };
      return { ok: false, status: 404, json: async () => ({ detail: "not found" }) };
    });

  beforeEach(() => {
    vi.stubGlobal("fetch", reply(200));
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderApp = () =>
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );

  it("enregistre la page initiale puis chaque changement de page", async () => {
    renderApp();
    await waitFor(() => expect(events().map((e) => e.name)).toContain("scenario"));
    await userEvent.click(screen.getByRole("tab", { name: /Épisode/ }));
    await waitFor(() => expect(events().map((e) => e.name)).toContain("episode"));
    expect(events().every((e) => e.kind === "page")).toBe(true);
  });

  it("enregistre une recherche réussie avec son étiquette et son détail", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Rechercher/ }));
    await waitFor(() => expect(events().some((e) => e.kind === "search")).toBe(true));
    const search = events().find((e) => e.kind === "search")!;
    expect(search.name).toMatch(/^[A-Z]{3} \d{4}$/);
    expect(search.detail).toMatch(/^mode=anchor · \w+ · k=\d+$/);
    expect(search.client_id).toBeTruthy();
  });

  it("n'enregistre pas de recherche quand elle échoue", async () => {
    vi.stubGlobal("fetch", reply(422));
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Rechercher/ }));
    await screen.findByText(/bad/);
    expect(events().some((e) => e.kind === "search")).toBe(false);
  });
});
