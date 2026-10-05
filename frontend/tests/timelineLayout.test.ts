import { describe, expect, it } from "vitest";

import type { EventOut } from "../src/api/types";
import {
  assignRows,
  computeRange,
  displayLabel,
  estimateLabelWidth,
  laneOf,
  niceStep,
  ticks,
  toItem,
  yearFraction,
} from "../src/lib/timelineLayout";

function ev(overrides: Partial<EventOut> & { id: number; date_start: string }): EventOut {
  return {
    country_iso3: "SWE",
    date_end: null,
    kind: "banking_crisis",
    label_fr: "x",
    label_en: "x",
    severity: null,
    source_id: "jst",
    source_url: "u",
    notes_fr: null,
    ...overrides,
  };
}

describe("timeline layout", () => {
  it("maps event kinds to lanes, unknown kinds to 'other'", () => {
    expect(laneOf("banking_crisis")).toBe("banking_crisis");
    expect(laneOf("monetary_regime")).toBe("regime");
    expect(laneOf("regime_change")).toBe("regime");
    expect(laneOf("oil_shock")).toBe("oil_shock");
    expect(laneOf("war")).toBe("war");
    expect(laneOf("something_new")).toBe("other");
  });

  it("converts an ISO date to a decimal year without time zones", () => {
    expect(yearFraction("1914-01-01")).toBeCloseTo(1914.0);
    expect(yearFraction("1914-07-28")).toBeCloseTo(1914 + 6 / 12 + 27 / 365, 6);
    expect(yearFraction("1991-01-01T00:00:00")).toBeCloseTo(1991.0);
  });

  it("treats an event without end, or shorter than six months, as a point", () => {
    expect(toItem(ev({ id: 1, date_start: "1991-01-01" }), "a").point).toBe(true);
    expect(toItem(ev({ id: 2, date_start: "1979-01-01", date_end: "1979-03-01" }), "a").point).toBe(true);
    const war = toItem(ev({ id: 3, kind: "war", date_start: "1914-07-28", date_end: "1918-11-11" }), "a");
    expect(war.point).toBe(false);
    expect(war.end).toBeGreaterThan(war.start + 4);
  });

  it("shortens banking-crisis labels to the year but keeps the full label", () => {
    const e = ev({ id: 1, date_start: "1991-01-01" });
    expect(displayLabel(e, "Crise bancaire systémique (Suède, 1991)")).toBe("1991");
    expect(displayLabel(e, "Systemic banking crisis (Sweden, 1991)")).toBe("1991");
    expect(displayLabel(e, "Autre libellé")).toBe("Autre libellé");
    expect(displayLabel(ev({ id: 2, kind: "war", date_start: "1914-07-28" }), "World War I (1914)")).toBe(
      "World War I (1914)",
    );
    expect(toItem(e, "Systemic banking crisis (Sweden, 1991)").fullLabel).toBe("Systemic banking crisis (Sweden, 1991)");
  });

  it("spans from the decade of the first event to the decade of the last one", () => {
    const items = [
      toItem(ev({ id: 1, date_start: "1878-01-01" }), "a"),
      toItem(ev({ id: 2, date_start: "2008-01-01" }), "b"),
    ];
    expect(computeRange(items, 1991, 1981, 2001)).toEqual({ min: 1870, max: 2010 });
  });

  it("includes the anchor and the window even when no event reaches them", () => {
    const items = [toItem(ev({ id: 1, date_start: "1931-01-01" }), "a")];
    expect(computeRange(items, 1991, 1981, 2001)).toEqual({ min: 1930, max: 2010 });
  });

  it("widens a too-short range so the axis stays readable", () => {
    const items = [toItem(ev({ id: 1, date_start: "1991-01-01" }), "a")];
    const { min, max } = computeRange(items, 1991, 1991, 1991);
    expect(max - min).toBeGreaterThanOrEqual(30);
    expect(min).toBeLessThanOrEqual(1991);
    expect(max).toBeGreaterThanOrEqual(1991);
  });

  it("uses the end of a range event for the right bound", () => {
    const items = [toItem(ev({ id: 1, kind: "war", date_start: "1939-09-01", date_end: "1945-09-02" }), "WWII")];
    expect(computeRange(items, 1940, 1930, 1950).max).toBe(1950);
  });

  it("picks the smallest round step that keeps ticks apart", () => {
    expect(niceStep(140, 1200, 54)).toBe(10); // 8,6 px par an
    expect(niceStep(140, 400, 54)).toBe(20); // 2,9 px par an
    expect(niceStep(30, 1200, 54)).toBe(2); // 40 px par an
    expect(niceStep(1000, 200, 54)).toBe(100);
  });

  it("lists ticks on multiples of the step inside the range", () => {
    expect(ticks(1870, 2010, 20)).toEqual([1880, 1900, 1920, 1940, 1960, 1980, 2000]);
    expect(ticks(1870, 1900, 10)).toEqual([1870, 1880, 1890, 1900]);
  });
});

describe("assignRows (no overlapping labels)", () => {
  const xFor = (y: number) => (y - 1870) * 8;
  const items = (specs: [number, number, string][]) =>
    specs.map(([start, end, label], i) => ({
      id: i, lane: "war" as const, label, fullLabel: label, start, end, point: start === end,
      startLabel: "", endLabel: null,
    }));

  it("keeps distant events on one row", () => {
    const { placed, rows } = assignRows(items([[1880, 1880, "A"], [1950, 1950, "B"]]), xFor, estimateLabelWidth, 2000);
    expect(rows).toBe(1);
    expect(placed.map((p) => p.row)).toEqual([0, 0]);
  });

  it("moves an event to a second row when its neighbour's label is in the way", () => {
    const { placed, rows } = assignRows(
      items([[1900, 1900, "Un libellé assez long"], [1902, 1902, "Autre libellé long"]]),
      xFor, estimateLabelWidth, 2000,
    );
    expect(rows).toBe(2);
    expect(placed.map((p) => p.row)).toEqual([0, 1]);
  });

  it("never lets two items of the same row overlap", () => {
    const specs: [number, number, string][] = Array.from({ length: 12 }, (_, i) => [1880 + i * 3, 1880 + i * 3, `Événement numéro ${i}`]);
    const { placed } = assignRows(items(specs), xFor, estimateLabelWidth, 3000);
    const byRow = new Map<number, typeof placed>();
    placed.forEach((p) => byRow.set(p.row, [...(byRow.get(p.row) ?? []), p]));
    for (const row of byRow.values()) {
      const sorted = [...row].sort((a, b) => a.extentStart - b.extentStart);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i].extentStart).toBeGreaterThanOrEqual(sorted[i - 1].extentEnd);
    }
  });

  it("puts the label on the left when it would run past the right edge", () => {
    const { placed } = assignRows(items([[2000, 2000, "Un libellé qui dépasse"]]), xFor, estimateLabelWidth, 1100);
    expect(placed[0].labelSide).toBe("left");
    expect(placed[0].extentEnd).toBeLessThanOrEqual(1100);
  });

  it("gives a range event a bar at least three pixels wide", () => {
    const { placed } = assignRows(items([[1900, 1900.1, "x"]]), xFor, estimateLabelWidth, 2000);
    expect(placed[0].x2 - placed[0].x1).toBeGreaterThanOrEqual(3);
  });
});
