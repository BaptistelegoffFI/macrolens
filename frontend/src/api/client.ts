// Par défaut, chemin relatif : le build Docker (servi derrière proxy/nginx.conf,
// voir docker-compose.yml § proxy) fonctionne alors sous n'importe quelle
// origine — accès direct local ou URL de tunnel public — sans reconstruire
// l'image. `npm run dev` fixe un VITE_API_URL absolu via .env.development,
// qui prend le pas sur ce défaut pendant le développement local.
const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

import { resilientFetch } from "./resilience";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = response.statusText;
    }
    throw new ApiError(response.status, detail);
  }
  try {
    return (await response.json()) as T;
  } catch {
    // Réponse 200 non JSON (page d'erreur d'un proxy) : une erreur typée, pas une SyntaxError.
    throw new ApiError(response.status, "invalid_response");
  }
}

export function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  // Base explicite : API_BASE peut être un chemin relatif (§ commentaire
  // ci-dessus), et `new URL()` sans base rejette toute chaîne non absolue.
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return resilientFetch(url).then((r) => handle<T>(r));
}

/** Les POST publics (recherche d'analogues, scénario, rendements) ne modifient rien : ils
 * réessaient. Le ping de fréquentation passe `retry: false`. */
export function apiPost<T>(path: string, body: unknown, options?: { retry?: boolean }): Promise<T> {
  return resilientFetch(
    `${API_BASE}${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    options,
  ).then((r) => handle<T>(r));
}

/** Panneau d'administration (§ADR 0008) : jeton porteur envoyé en en-tête,
 * jamais dans l'URL ni le corps sérialisé au repos. */
export function apiGetAuth<T>(path: string, token: string): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  return resilientFetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => handle<T>(r));
}

export function apiPostAuth<T>(path: string, body: unknown, token: string): Promise<T> {
  return resilientFetch(
    `${API_BASE}${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
    { retry: false },
  ).then((r) => handle<T>(r));
}

export function apiPutAuth<T>(path: string, body: unknown, token: string): Promise<T> {
  return resilientFetch(
    `${API_BASE}${path}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
    { retry: false },
  ).then((r) => handle<T>(r));
}
