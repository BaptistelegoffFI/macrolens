import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("App", () => {
  it("renders the phase 0 placeholder", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "MacroLens" })).toBeInTheDocument();
  });
});
