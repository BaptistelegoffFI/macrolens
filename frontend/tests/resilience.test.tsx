import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiGet, apiPost } from "../src/api/client";
import { recordView } from "../src/api/endpoints";
import { configureRetry, isWaking } from "../src/api/resilience";
import { FailSafe } from "../src/components/shell/FailSafe";
import { RootFallback } from "../src/components/shell/RootFallback";
import { WakingBanner } from "../src/components/shell/WakingBanner";
import { LanguageProvider } from "../src/i18n/LanguageContext";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const html = (status: number) =>
  new Response("<html>starting</html>", { status, headers: { "Content-Type": "text/html" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  configureRetry({ delaysMs: [0, 0, 0], timeoutMs: 5000 });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("client résilient", () => {
  it("réessaie après une erreur réseau puis renvoie la réponse", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(json({ ok: 1 }));
    await expect(apiGet("/x")).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(isWaking()).toBe(false);
  });

  it.each([502, 504])("réessaie sur un %i du proxy", async (status) => {
    fetchMock.mockResolvedValueOnce(html(status)).mockResolvedValueOnce(json({ ok: 1 }));
    await expect(apiGet("/x")).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("réessaie sur un 503 HTML mais pas sur un 503 applicatif avec detail", async () => {
    fetchMock.mockResolvedValueOnce(html(503)).mockResolvedValueOnce(json({ ok: 1 }));
    await expect(apiGet("/x")).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json({ detail: "state vectors not built" }, 503));
    await expect(apiGet("/x")).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ne réessaie pas une erreur applicative (404, 422)", async () => {
    fetchMock.mockResolvedValue(json({ detail: "unknown country" }, 404));
    await expect(apiGet("/x")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("abandonne après le nombre maximal de tentatives", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiGet("/x")).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 + 3 attentes
    expect(isWaking()).toBe(false);
  });

  it("renvoie la dernière réponse d'erreur si le proxy reste en 502", async () => {
    fetchMock.mockResolvedValue(html(502));
    await expect(apiGet("/x")).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("transforme un 200 non JSON en ApiError", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(apiGet("/x")).rejects.toMatchObject({ status: 200, detail: "invalid_response" });
  });

  it("réessaie les POST publics (recherche)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("x")).mockResolvedValueOnce(json({ n: 2 }));
    await expect(apiPost("/analogs/search", { a: 1 })).resolves.toEqual({ n: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("n'essaie qu'une fois le ping de fréquentation", async () => {
    fetchMock.mockRejectedValue(new TypeError("x"));
    await expect(recordView({} as never)).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("interrompt une tentative qui dépasse le délai puis réessaie", async () => {
    configureRetry({ delaysMs: [0], timeoutMs: 20 });
    fetchMock
      .mockImplementationOnce(
        (_url: unknown, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      )
      .mockResolvedValueOnce(json({ ok: 1 }));
    await expect(apiGet("/x")).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("bandeau de réveil", () => {
  it("apparaît pendant les nouvelles tentatives puis disparaît", async () => {
    configureRetry({ delaysMs: [30], timeoutMs: 5000 });
    let release: (r: Response) => void = () => {};
    fetchMock
      .mockRejectedValueOnce(new TypeError("x"))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (release = resolve)));
    render(
      <LanguageProvider>
        <WakingBanner />
      </LanguageProvider>,
    );
    expect(screen.queryByTestId("waking-banner")).toBeNull();
    let pending!: Promise<unknown>;
    await act(async () => {
      pending = apiGet("/x");
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByTestId("waking-banner")).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
      release(json({ ok: 1 }));
      await pending;
    });
    expect(screen.queryByTestId("waking-banner")).toBeNull();
  });
});

describe("filet racine", () => {
  it("remplace une application qui plante par un message avec bouton de rechargement", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Boom(): never {
      throw new Error("boom");
    }
    render(
      <FailSafe fallback={<RootFallback />}>
        <Boom />
      </FailSafe>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("MacroLens");
    expect(screen.getByRole("button", { name: /Recharger/ })).toBeInTheDocument();
    spy.mockRestore();
  });
});
