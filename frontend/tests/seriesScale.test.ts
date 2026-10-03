import { describe, expect, it } from "vitest";

import { applyScale, commonStartYear, scaleAvailability } from "../src/lib/seriesScale";
import type { PointsByCountry } from "../src/lib/seriesScale";

const data: PointsByCountry = {
  AAA: [
    [2000, 100],
    [2001, 110],
    [2002, 121],
  ],
  BBB: [
    [2001, 5000],
    [2002, 5500],
    [2003, 6050],
  ],
};

describe("commonStartYear", () => {
  it("returns the first year shared by every series", () => {
    expect(commonStartYear(data)).toBe(2001);
  });

  it("returns null when no year is shared", () => {
    expect(commonStartYear({ A: [[1990, 1]], B: [[2000, 1]] })).toBeNull();
  });

  it("ignores empty series", () => {
    expect(commonStartYear({ ...data, CCC: [] })).toBe(2001);
  });
});

describe("scaleAvailability", () => {
  it("allows log and base 100 for strictly positive series", () => {
    expect(scaleAvailability(data)).toEqual({ log: null, base100: null });
  });

  it("disables both when a value is zero or negative", () => {
    const withNegative: PointsByCountry = { A: [[2000, -1], [2001, 2]] };
    expect(scaleAvailability(withNegative)).toEqual({ log: "non_positive", base100: "non_positive" });
    expect(scaleAvailability({ A: [[2000, 0]] }).log).toBe("non_positive");
  });

  it("disables base 100 only when series share no year", () => {
    expect(scaleAvailability({ A: [[1990, 1]], B: [[2000, 1]] })).toEqual({
      log: null,
      base100: "no_common_year",
    });
  });
});

describe("applyScale", () => {
  it("level leaves the data untouched", () => {
    expect(applyScale("level", data)).toEqual({ mode: "level", baseYear: null, series: data });
  });

  it("log keeps raw values (the axis does the transformation)", () => {
    const result = applyScale("log", data);
    expect(result.mode).toBe("log");
    expect(result.series).toBe(data);
  });

  it("log falls back to level when a value is not positive", () => {
    const result = applyScale("log", { A: [[2000, 0], [2001, 1]] });
    expect(result.mode).toBe("level");
  });

  it("base 100 rebases every series to 100 at the first common year", () => {
    const result = applyScale("base100", data);
    expect(result.mode).toBe("base100");
    expect(result.baseYear).toBe(2001);
    expect(result.series.AAA.find((p) => p[0] === 2001)?.[1]).toBeCloseTo(100);
    expect(result.series.BBB.find((p) => p[0] === 2001)?.[1]).toBeCloseTo(100);
    expect(result.series.AAA.find((p) => p[0] === 2002)?.[1]).toBeCloseTo(110);
    expect(result.series.BBB.find((p) => p[0] === 2002)?.[1]).toBeCloseTo(110);
    expect(result.series.BBB.find((p) => p[0] === 2003)?.[1]).toBeCloseTo(121);
    // L'année antérieure à la base reste affichée, rebasée.
    expect(result.series.AAA.find((p) => p[0] === 2000)?.[1]).toBeCloseTo(90.909, 2);
  });

  it("base 100 falls back to level without a common year", () => {
    expect(applyScale("base100", { A: [[1990, 1]], B: [[2000, 1]] }).mode).toBe("level");
  });

  it("z-score gives mean 0 and population standard deviation 1 per series", () => {
    const result = applyScale("zscore", data);
    for (const pts of Object.values(result.series)) {
      const values = pts.map((p) => p[1]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      expect(mean).toBeCloseTo(0, 10);
      expect(variance).toBeCloseTo(1, 10);
    }
  });

  it("z-score of a constant series is 0, not NaN", () => {
    const result = applyScale("zscore", { A: [[2000, 5], [2001, 5]] });
    expect(result.series.A.map((p) => p[1])).toEqual([0, 0]);
  });
});
