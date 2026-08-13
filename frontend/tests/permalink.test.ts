import { describe, expect, it } from "vitest";

import type { AnalogsSearchRequest } from "../src/api/types";
import { decodePermalink, encodePermalink } from "../src/lib/permalink";

describe("permalink encode/decode", () => {
  it("round-trips a full search request exactly", () => {
    const request: AnalogsSearchRequest = {
      mode: "anchor",
      anchor: { country: "FRA", year: 2019 },
      k: 20,
      horizons: [1, 3, 5, 10],
      weights: { prices: 0.5, rates: 0.5 },
      metric: "euclidean",
      reference_frame: "rolling30",
    };
    const encoded = encodePermalink(request);
    expect(decodePermalink(encoded)).toEqual(request);
  });

  it("handles accented country names and special characters safely", () => {
    const request: AnalogsSearchRequest = {
      mode: "manual",
      state: { infl_level: 8.5 },
      k: 5,
    };
    const encoded = encodePermalink(request);
    expect(decodePermalink(encoded)).toEqual(request);
  });

  it("returns null for garbage input rather than throwing", () => {
    expect(decodePermalink("not-valid-base64!!!")).toBeNull();
  });
});
