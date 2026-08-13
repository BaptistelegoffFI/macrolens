import { describe, expect, it } from "vitest";

import { parseCommand } from "../src/lib/commandParser";

describe("parseCommand", () => {
  it("parses an anchor command", () => {
    expect(parseCommand("FRA 2025")).toEqual({ type: "anchor", country: "FRA", year: 2025 });
  });

  it("parses a lowercase anchor command", () => {
    expect(parseCommand("fra 2025")).toEqual({ type: "anchor", country: "FRA", year: 2025 });
  });

  it("parses a compare command", () => {
    expect(parseCommand("SWE 1990 vs FIN 1990")).toEqual({
      type: "compare",
      pairs: [
        { country: "SWE", year: 1990 },
        { country: "FIN", year: 1990 },
      ],
    });
  });

  it("returns unknown for unrecognized input", () => {
    expect(parseCommand("credit_gap5")).toEqual({ type: "unknown", raw: "credit_gap5" });
  });

  it("returns unknown for empty input", () => {
    expect(parseCommand("   ")).toEqual({ type: "unknown", raw: "   " });
  });
});
