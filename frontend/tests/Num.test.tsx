import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Num } from "../src/components/table/Num";

describe("Num", () => {
  it("formats with fixed decimals, sign and unit", () => {
    render(<Num value={8.333} decimals={1} unit="%" sign />);
    expect(screen.getByText("+8.3%")).toBeInTheDocument();
  });

  it("shows a dash for a missing value, never zero", () => {
    render(<Num value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("uses scientific notation for absurdly large values instead of overflowing the cell", () => {
    render(<Num value={105709670324.3 * 100} decimals={1} unit="%" sign />);
    expect(screen.getByText("+1.06e+13%")).toBeInTheDocument();
  });

  it("keeps ordinary large values in full", () => {
    render(<Num value={3964058.09} decimals={2} />);
    expect(screen.getByText("3964058.09")).toBeInTheDocument();
  });
});
