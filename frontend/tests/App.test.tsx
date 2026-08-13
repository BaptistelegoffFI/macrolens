import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("App", () => {
  it("renders the window shell (§11.2): menu bar, view tabs, status bar", () => {
    render(<App />);
    expect(screen.getByRole("menubar", { name: "Barre de menus" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Scénario/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Épisode/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("aucun build chargé");
  });

  it("switches views when a tab is clicked (§11.3)", async () => {
    render(<App />);
    // Comparateur ne récupère rien tant que « Comparer » n'est pas cliqué —
    // testable sans mocker fetch, contrairement aux autres vues (Épisode,
    // Explorateur, Couverture, Sources) qui chargent au montage.
    await userEvent.click(screen.getByRole("tab", { name: /Comparateur/ }));
    expect(screen.getByRole("tab", { name: /Comparateur/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /Comparer/ })).toBeInTheDocument();
  });
});
