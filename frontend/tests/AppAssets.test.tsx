import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { LanguageProvider } from "../src/i18n/LanguageContext";

vi.mock("echarts", () => ({
  init: () => ({ setOption: () => {}, resize: () => {}, dispose: () => {} }),
}));

describe("App with the Asset classes tab (ADR 0022, 0024)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Tout échoue : le reste de l'application doit rester pilotable.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("adds the Asset classes tab with its F9 shortcut", () => {
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );
    expect(screen.getByRole("tab", { name: /Classes d'actifs\s*F9/ })).toBeInTheDocument();
  });

  it("opens the page with F9 and keeps every other tab working when its data fails", async () => {
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );
    await userEvent.keyboard("{F9}");
    expect(screen.getByRole("tab", { name: /Classes d'actifs/ })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText(/Rendements d'actifs indisponibles/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Scénario/ }));
    expect(screen.getByRole("tab", { name: /Scénario/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: /Comparateur/ }));
    expect(screen.getByRole("button", { name: /Comparer/ })).toBeInTheDocument();
  });
});
