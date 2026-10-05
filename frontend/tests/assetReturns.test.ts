import { describe, expect, it } from "vitest";

import { isAssetReturnsResponse } from "../src/hooks/useAssetReturns";
import {
  ASSET_SERIES_OPTIONS,
  CLASS_LABELS,
  axisPercent,
  exclusionEntries,
  percent,
  positiveCount,
  quantilesFor,
  tooltipPercent,
} from "../src/lib/assetReturns";
import { ASSET_RETURNS_FIXTURE, cell } from "./fixtures/assetReturns";

describe("lib/assetReturns", () => {
  it("converts a fraction to a percentage and keeps missing values missing", () => {
    expect(percent(0.0833)).toBeCloseTo(8.33);
    expect(percent(null)).toBeNull();
    expect(percent(undefined)).toBeNull();
  });

  it("counts positive analogues from the hit rate, null when there is no hit rate", () => {
    expect(positiveCount(cell({ horizon: 1, n: 20, hit_rate: 0.55 }))).toBe(11);
    expect(positiveCount(cell({ horizon: 1, n: 0, hit_rate: null }))).toBeNull();
  });

  it("selects the quantiles of the displayed measure", () => {
    const c = cell({ horizon: 1 });
    expect(quantilesFor(c, "cumulative")).toBe(c.cumulative);
    expect(quantilesFor(c, "annualised")).toBe(c.annualised);
    expect(quantilesFor(c, "drawdown")).toBe(c.max_drawdown);
    expect(quantilesFor(cell({ horizon: 1, max_drawdown: null }), "drawdown")).toBeNull();
  });

  it("lists exclusion reasons from most to least frequent and skips zero counts", () => {
    const entries = exclusionEntries(
      cell({ horizon: 3, exclusions: { before_start: 0, truncated_end: 3, gap: 1, no_series: 0 } }),
    );
    expect(entries).toEqual([
      ["truncated_end", 3],
      ["gap", 1],
    ]);
  });

  it("formats chart values as percentages", () => {
    expect(axisPercent(0.25)).toBe("25%");
    expect(tooltipPercent(-0.1578)).toBe("-15.8%");
    expect(tooltipPercent("x")).toBe("x");
  });

  it("labels the six classes in both languages and offers six explorer series", () => {
    expect(Object.keys(CLASS_LABELS)).toEqual(["equities", "govt_bonds", "cash", "housing", "fx", "inflation"]);
    expect(ASSET_SERIES_OPTIONS).toHaveLength(6);
    expect(ASSET_SERIES_OPTIONS.every((o) => o.fr && o.en && o.id.startsWith("jst."))).toBe(true);
  });
});

describe("isAssetReturnsResponse (contract guard)", () => {
  it("accepts a response of the versioned contract", () => {
    expect(isAssetReturnsResponse(ASSET_RETURNS_FIXTURE)).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "oops"],
    ["an analogs-search payload", { build_id: "x", analogs: [] }],
    ["a wrong schema version", { ...ASSET_RETURNS_FIXTURE, schema_version: "other/1" }],
    ["missing classes", { ...ASSET_RETURNS_FIXTURE, classes: undefined }],
    ["missing paths", { ...ASSET_RETURNS_FIXTURE, forward_paths: undefined }],
  ])("rejects %s", (_label, value) => {
    expect(isAssetReturnsResponse(value)).toBe(false);
  });
});
