import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventOut } from "../src/api/types";
import { LanguageProvider } from "../src/i18n/LanguageContext";
import { EpisodeView } from "../src/views/EpisodeView";

vi.mock("echarts", () => ({
  init: () => ({ setOption: () => {}, resize: () => {}, dispose: () => {}, getDataURL: () => "" }),
}));

function ev(id: number, kind: string, start: string, end: string | null, label: string): EventOut {
  return {
    id, country_iso3: "SWE", date_start: start, date_end: end, kind, label_fr: label, label_en: label,
    severity: null, source_id: "jst", source_url: "u", notes_fr: null,
  };
}

const NEAR = [ev(10, "banking_crisis", "1991-01-01", null, "Systemic banking crisis (Sweden, 1991)")];
const FULL = [
  ev(1, "banking_crisis", "1878-01-01", null, "Systemic banking crisis (Sweden, 1878)"),
  ev(2, "war", "1914-07-28", "1918-11-11", "World War I"),
  ...NEAR,
  ev(11, "banking_crisis", "2008-01-01", null, "Systemic banking crisis (Sweden, 2008)"),
];

function install(eventsBehaviour: "ok" | "fail") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/episodes/")) {
        return { ok: true, json: async () => ({ country: "SWE", year: 1991, state: null, series: {}, events: NEAR, sources: [] }) };
      }
      if (url.includes("/events")) {
        if (eventsBehaviour === "fail") throw new Error("events down");
        return { ok: true, json: async () => FULL };
      }
      return { ok: true, json: async () => [] };
    }),
  );
}

describe("Episode view timeline", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("draws the full event history of the country, not only the events near the window", async () => {
    install("ok");
    render(
      <LanguageProvider>
        <EpisodeView initialCountry="SWE" initialYear={1991} />
      </LanguageProvider>,
    );
    expect(await screen.findByRole("img", { name: "Frise de 4 événements, de 1870 à 2010" })).toBeInTheDocument();
    expect(screen.getByText("1878")).toBeInTheDocument();
    expect(screen.getByText("2008")).toBeInTheDocument();
    expect(screen.getByText("World War I", { selector: "text" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ href: expect.stringMatching(/\/events\?country=SWE/) }));
  });

  it("falls back to the episode's own events when the events request fails", async () => {
    install("fail");
    render(
      <LanguageProvider>
        <EpisodeView initialCountry="SWE" initialYear={1991} />
      </LanguageProvider>,
    );
    expect(await screen.findByRole("img", { name: /Frise de 1 événements/ })).toBeInTheDocument();
    expect(screen.getByText("1991")).toBeInTheDocument();
  });
});
