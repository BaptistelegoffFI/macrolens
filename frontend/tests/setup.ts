import "@testing-library/jest-dom/vitest";

// jsdom n'implémente pas ResizeObserver — utilisé par le wrapper ECharts
// (src/components/charts/EChart.tsx) pour redimensionner au conteneur.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// Résilience réseau (ADR 0027) : en test, les nouvelles tentatives ne doivent pas attendre.
import { configureRetry } from "../src/api/resilience";

configureRetry({ delaysMs: [0, 0, 0], timeoutMs: 5000 });
