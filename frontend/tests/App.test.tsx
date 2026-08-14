import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { LanguageProvider } from "../src/i18n/LanguageContext";

describe("App", () => {
  // Le choix de langue est persisté en localStorage (§ADR 0006) — isole
  // chaque test du choix laissé par le précédent.
  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders the window shell (§11.2): title bar, view tabs, status bar", () => {
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );
    expect(screen.getByRole("group", { name: "Langue de l'interface" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Scénario/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Épisode/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("aucun build chargé");
  });

  it("switches views when a tab is clicked (§11.3)", async () => {
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );
    // Comparateur ne récupère rien tant que « Comparer » n'est pas cliqué —
    // testable sans mocker fetch, contrairement aux autres vues (Épisode,
    // Explorateur, Couverture, Sources) qui chargent au montage.
    await userEvent.click(screen.getByRole("tab", { name: /Comparateur/ }));
    expect(screen.getByRole("tab", { name: /Comparateur/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /Comparer/ })).toBeInTheDocument();
  });

  it("switches interface language when FR/EN is clicked (Phase 7)", async () => {
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );
    expect(screen.getByRole("tab", { name: /Scénario/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByRole("tab", { name: /^Scenario/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search [F5]" })).toBeInTheDocument();
  });
});
