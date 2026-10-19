import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../src/i18n/LanguageContext";
import { AdminView } from "../src/views/AdminView";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

const ACTIVITY = {
  events: [
    { at: "2026-10-05T14:03:09Z", kind: "search", name: "SWE 1991", detail: "mode=anchor · era · k=20", device: "a1b2c3" },
    { at: "2026-10-05T14:02:30Z", kind: "page", name: "episode", detail: null, device: "a1b2c3" },
    { at: "2026-10-04T08:15:00Z", kind: "visit", name: null, detail: null, device: "d4e5f6" },
  ],
};
const RANKINGS = (days: number) => ({
  days,
  pages: [
    { name: "scenario", count: 9, devices: 3 },
    { name: "assets", count: 4, devices: 2 },
  ],
  searches: [{ name: "SWE 1991", count: 7, devices: 3 }],
  countries: [{ name: "SWE", count: 7, devices: 3 }],
});

let calls: string[];

beforeEach(() => {
  calls = [];
  sessionStorage.setItem("ml.admin.token", "tok");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/admin/activity")) return json(ACTIVITY);
      if (url.includes("/admin/rankings")) return json(RANKINGS(Number(new URL(url, "http://x").searchParams.get("days"))));
      if (url.includes("/admin/analytics"))
        return json({ total_views: 5, unique_devices: 2, views_last_7_days: 5, unique_devices_last_7_days: 2, daily: [] });
      return json({ maintenance_mode: false, maintenance_message: null, announcement: null });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

const renderAdmin = () =>
  render(
    <LanguageProvider>
      <AdminView />
    </LanguageProvider>,
  );

describe("panneau admin : journal et classements", () => {
  it("affiche l'heure de chaque ligne du journal, la plus récente d'abord", async () => {
    renderAdmin();
    const log = await screen.findByRole("complementary", { name: /Journal d'activité|Activity log/ });
    const items = await within(log).findAllByRole("listitem");
    expect(items).toHaveLength(3);
    const times = items.map((li) => li.querySelector("time")?.getAttribute("datetime"));
    expect(times).toEqual(["2026-10-05T14:03:09Z", "2026-10-05T14:02:30Z", "2026-10-04T08:15:00Z"]);
    for (const li of items) expect(li.querySelector("time")?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(within(items[0]).getByText("SWE 1991")).toBeInTheDocument();
    expect(within(items[0]).getByText("mode=anchor · era · k=20")).toBeInTheDocument();
    expect(within(items[1]).getByText(/Épisode|Episode/)).toBeInTheDocument();
    // Le jour change entre la 2e et la 3e ligne : un séparateur de jour par jour distinct.
    expect(log.querySelectorAll("li > div:first-child:not([data-kind])").length).toBe(2);
  });

  it("classe les pages, les recherches et les pays", async () => {
    renderAdmin();
    expect(await screen.findByText(/Pages les plus utilisées|Most used pages/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("SWE 1991").length).toBeGreaterThan(0));
    expect(screen.getByText("SWE")).toBeInTheDocument();
    expect(screen.getByText(/^9 \(3 (appareils|devices)\)$/)).toBeInTheDocument();
  });

  it("recharge les classements quand la période change", async () => {
    renderAdmin();
    await screen.findByText(/Pages les plus utilisées|Most used pages/);
    expect(calls.some((u) => u.includes("/admin/rankings?days=30"))).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^7 jours$|^7 days$/ }));
    await waitFor(() => expect(calls.some((u) => u.includes("/admin/rankings?days=7"))).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: /^Tout$|^All time$/ }));
    await waitFor(() => expect(calls.some((u) => u.includes("/admin/rankings?days=0"))).toBe(true));
  });

  it("n'appelle ni journal ni classements sans être connecté", async () => {
    sessionStorage.clear();
    renderAdmin();
    await screen.findByLabelText(/Jeton d'administration|Admin token/);
    expect(calls.some((u) => u.includes("/admin/activity") || u.includes("/admin/rankings"))).toBe(false);
  });
});
