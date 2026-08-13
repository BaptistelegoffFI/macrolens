import "@testing-library/jest-dom/vitest";

// jsdom n'implémente pas ResizeObserver — utilisé par le wrapper ECharts
// (src/components/charts/EChart.tsx) pour redimensionner au conteneur.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
