import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EventOut } from "../src/api/types";
import { EpisodeTimeline } from "../src/components/charts/EpisodeTimeline";
import { LanguageProvider } from "../src/i18n/LanguageContext";

function ev(id: number, kind: string, start: string, end: string | null, fr: string, en: string): EventOut {
  return {
    id, country_iso3: "SWE", date_start: start, date_end: end, kind, label_fr: fr, label_en: en,
    severity: null, source_id: "jst", source_url: "u", notes_fr: null,
  };
}

const EVENTS: EventOut[] = [
  ev(1, "banking_crisis", "1878-01-01", null, "Crise bancaire systémique (Suède, 1878)", "Systemic banking crisis (Sweden, 1878)"),
  ev(2, "war", "1914-07-28", "1918-11-11", "Première Guerre mondiale", "World War I"),
  ev(3, "monetary_regime", "1944-07-22", "1971-08-15", "Système de Bretton Woods", "Bretton Woods system"),
  ev(4, "oil_shock", "1973-10-17", "1974-03-18", "Premier choc pétrolier", "1973 oil crisis"),
  ev(5, "banking_crisis", "2008-01-01", null, "Crise bancaire systémique (Suède, 2008)", "Systemic banking crisis (Sweden, 2008)"),
];

function renderTimeline(events = EVENTS) {
  return render(
    <LanguageProvider>
      <EpisodeTimeline events={events} anchorYear={1991} windowStart={1981} windowEnd={2001} />
    </LanguageProvider>,
  );
}

describe("EpisodeTimeline", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("spans from the decade of the first event to the decade of the last one", () => {
    renderTimeline();
    expect(screen.getByRole("img", { name: "Frise de 5 événements, de 1870 à 2010" })).toBeInTheDocument();
    expect(screen.getByText("1870 à 2010")).toBeInTheDocument();
    // Graduations rondes à l'intérieur de l'étendue (tous les 20 ans pour une largeur de 900 px).
    const svg = screen.getByRole("img") as unknown as HTMLElement;
    for (const year of ["1880", "1920", "1960", "2000"]) {
      expect(within(svg).getByText(year)).toBeInTheDocument();
    }
  });

  it("draws one lane per event type, and none for types without events", () => {
    renderTimeline();
    for (const lane of ["Crises bancaires", "Guerres", "Régimes monétaires et politiques", "Chocs pétroliers"]) {
      expect(screen.getByText(lane)).toBeInTheDocument();
    }
    expect(screen.queryByText("Autres événements")).not.toBeInTheDocument();
  });

  it("labels the anchor and the window of the charts above", () => {
    renderTimeline();
    expect(screen.getByText("1991 · ancre")).toBeInTheDocument();
    expect(screen.getByText("fenêtre des graphiques ci-dessus, 1981 à 2001")).toBeInTheDocument();
  });

  it("shows banking crises by year and keeps the full label in the tooltip", () => {
    renderTimeline();
    expect(screen.getByText("1878")).toBeInTheDocument();
    expect(screen.getByText("2008")).toBeInTheDocument();
    expect(screen.getByText(/Crise bancaire systémique \(Suède, 1878\)/, { selector: "title" })).toBeInTheDocument();
  });

  it("keeps other event labels in full and gives every event a dated tooltip", () => {
    renderTimeline();
    expect(screen.getByText("Première Guerre mondiale", { selector: "text" })).toBeInTheDocument();
    expect(screen.getByText(/1914-07-28 → 1918-11-11/, { selector: "title" })).toBeInTheDocument();
    expect(screen.getByText("Système de Bretton Woods", { selector: "text" })).toBeInTheDocument();
  });

  it("right-aligns the window label when the window sits at the end of the axis", () => {
    render(
      <LanguageProvider>
        <EpisodeTimeline events={[EVENTS[1]]} anchorYear={2008} windowStart={1998} windowEnd={2018} />
      </LanguageProvider>,
    );
    const label = screen.getByText("fenêtre des graphiques ci-dessus, 1998 à 2018");
    expect(label).toHaveAttribute("text-anchor", "end");
  });

  it("keeps the window label left-aligned when there is room", () => {
    render(
      <LanguageProvider>
        <EpisodeTimeline events={EVENTS} anchorYear={1931} windowStart={1921} windowEnd={1941} />
      </LanguageProvider>,
    );
    expect(screen.getByText("fenêtre des graphiques ci-dessus, 1921 à 1941")).toHaveAttribute("text-anchor", "start");
  });

  it("renders in English", () => {
    window.localStorage.setItem("ml.lang", "en");
    renderTimeline();
    expect(screen.getByText("Banking crises")).toBeInTheDocument();
    expect(screen.getByText("1991 · anchor")).toBeInTheDocument();
    expect(screen.getByText("World War I", { selector: "text" })).toBeInTheDocument();
  });

  it("says so when there are no events", () => {
    renderTimeline([]);
    expect(screen.getByText("Aucun événement recensé pour ce pays.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("stays valid with a single event", () => {
    renderTimeline([EVENTS[0]]);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText("1878")).toBeInTheDocument();
  });
});
