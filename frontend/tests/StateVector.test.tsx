import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StateVector } from "../src/components/scenario/StateVector";
import { LanguageProvider } from "../src/i18n/LanguageContext";

const FEATURES = [
  { feature_code: "infl_level", raw_value: 9.32, pct_rank: 0.73 },
  { feature_code: "infl_accel", raw_value: 2.89, pct_rank: 0.73 },
  { feature_code: "debt_level", raw_value: 40.89, pct_rank: 0.67 },
];

const renderIn = (lang: "fr" | "en", props: Partial<Parameters<typeof StateVector>[0]> = {}) => {
  localStorage.setItem("ml.lang", lang);
  return render(
    <LanguageProvider>
      <StateVector features={FEATURES} {...props} />
    </LanguageProvider>,
  );
};

afterEach(() => localStorage.clear());

describe("vecteur d'état partagé", () => {
  it("groupe par famille avec les libellés courts, jamais les codes bruts", () => {
    renderIn("en");
    expect(screen.getByRole("region", { name: "Prices" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Debt" })).toBeInTheDocument();
    expect(screen.getByText("Infl.")).toBeInTheDocument();
    expect(screen.getByText("Debt/GDP")).toBeInTheDocument();
    expect(screen.queryByText("infl_level")).toBeNull();
    // Les familles sans variable fournie ne sont pas dessinées.
    expect(screen.queryByRole("region", { name: "Credit" })).toBeNull();
  });

  it("suit la langue", () => {
    renderIn("fr");
    expect(screen.getByRole("region", { name: "Prix" })).toBeInTheDocument();
    expect(screen.getByText("Dette/PIB")).toBeInTheDocument();
  });

  it("affiche valeur et rang, et explique « r= » au survol", () => {
    renderIn("en");
    const row = screen.getByText("Infl.").closest("div") as HTMLElement;
    expect(within(row).getByText("9.32")).toBeInTheDocument();
    const rank = within(row).getByText(/^r=/);
    expect(rank).toHaveAttribute("title", expect.stringMatching(/percentile rank/i));
    expect(rank).toHaveTextContent("r=0.73");
  });

  it("met en évidence les variables demandées, et elles seules", () => {
    renderIn("en", { highlight: new Set(["debt_level"]) });
    expect(screen.getByText("Debt/GDP").closest("div")).toHaveAttribute("data-highlight", "true");
    expect(screen.getByText("Infl.").closest("div")).toHaveAttribute("data-highlight", "false");
  });

  it("ne montre la légende de r= que si elle est demandée", () => {
    const { unmount } = renderIn("en");
    expect(screen.queryByText(/percentile rank of the value in its reference window/)).toBeNull();
    unmount();
    renderIn("en", { showLegend: true });
    expect(screen.getByText(/r = percentile rank of the value in its reference window/)).toBeInTheDocument();
  });
});
