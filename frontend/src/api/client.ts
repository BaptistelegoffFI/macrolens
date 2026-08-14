// Par défaut, chemin relatif : le build Docker (servi derrière proxy/nginx.conf,
// voir docker-compose.yml § proxy) fonctionne alors sous n'importe quelle
// origine — accès direct local ou URL de tunnel public — sans reconstruire
// l'image. `npm run dev` fixe un VITE_API_URL absolu via .env.development,
// qui prend le pas sur ce défaut pendant le développement local.
const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

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
  return response.json() as Promise<T>;
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
  return fetch(url).then((r) => handle<T>(r));
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => handle<T>(r));
}
