import { useState } from "react";

export type ScenarioMode = "anchor" | "manual" | "shock";

export interface ToolbarState {
  mode: ScenarioMode;
  k: number;
  horizons: number[];
  metric: "euclidean";
}

export function useToolbarState(initial?: Partial<ToolbarState>) {
  return useState<ToolbarState>({
    mode: "anchor",
    k: 20,
    horizons: [1, 3, 5, 10],
    metric: "euclidean",
    ...initial,
  });
}
