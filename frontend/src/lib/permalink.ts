import type { AnalogsSearchRequest } from "../api/types";

/** §11.3 : « le permalien reproduit exactement une recherche ». On encode
 * la requête complète (mode, ancre/état/choc, k, horizons, poids) dans le
 * paramètre `q` — jamais un sous-ensemble qui perdrait des choix de
 * l'utilisateur. */
export function encodePermalink(request: AnalogsSearchRequest): string {
  const json = JSON.stringify(request);
  return btoa(encodeURIComponent(json));
}

export function decodePermalink(encoded: string): AnalogsSearchRequest | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    return JSON.parse(json) as AnalogsSearchRequest;
  } catch {
    return null;
  }
}

export function setPermalinkParam(request: AnalogsSearchRequest): void {
  const url = new URL(window.location.href);
  url.searchParams.set("q", encodePermalink(request));
  window.history.replaceState(null, "", url.toString());
}

export function readPermalinkParam(): AnalogsSearchRequest | null {
  const url = new URL(window.location.href);
  const q = url.searchParams.get("q");
  return q ? decodePermalink(q) : null;
}
