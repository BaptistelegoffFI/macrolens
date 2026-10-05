/** Résilience réseau (ADR 0027). L'API tourne sur une offre gratuite qui s'endort après une période
 * d'inactivité : le premier appel qui la réveille échoue (erreur réseau, 502/503/504, ou délai) alors
 * que quelques dizaines de secondes plus tard tout fonctionne. Le client réessaie donc avec une
 * attente croissante au lieu de renvoyer une erreur au visiteur, et signale l'attente par un bandeau.
 *
 * Seules les requêtes idempotentes réessaient (lectures et recherches, qui ne modifient rien) ; les
 * écritures d'administration et le ping de fréquentation tentent une seule fois. */

export interface RetryPolicy {
  /** Attente avant chaque nouvelle tentative ; sa longueur fixe le nombre de tentatives − 1. */
  delaysMs: number[];
  /** Délai maximal d'une tentative. */
  timeoutMs: number;
}

const DEFAULT_POLICY: RetryPolicy = {
  delaysMs: [1500, 3000, 6000, 10000, 15000],
  timeoutMs: 45000,
};

let policy: RetryPolicy = DEFAULT_POLICY;

export function configureRetry(next: Partial<RetryPolicy>): void {
  policy = { ...policy, ...next };
}

// ---- état « le serveur se réveille » -------------------------------------------------------

let waking = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeWaking(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Vrai tant qu'au moins une requête est en train de réessayer après un échec transitoire. */
export function isWaking(): boolean {
  return waking > 0;
}

// ---- requête -------------------------------------------------------------------------------

function isTransientStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/** Un 503 portant un `detail` JSON vient de l'application elle-même (refus délibéré) : on ne le
 * réessaie pas. Un 502/504, ou un 503 sans JSON, vient du proxy de l'hébergeur pendant un réveil. */
async function isTransientResponse(response: Response): Promise<boolean> {
  if (!isTransientStatus(response.status)) return false;
  if (response.status !== 503) return true;
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return true;
  try {
    const body = (await response.clone().json()) as { detail?: unknown };
    return body.detail === undefined;
  } catch {
    return true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attempt(input: RequestInfo | URL, init: RequestInit | undefined): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface RequestOptions {
  /** Faux pour une écriture ou un ping : une seule tentative, comportement d'origine. */
  retry?: boolean;
}

/** `fetch` avec délai par tentative et nouvelles tentatives sur échec transitoire. Renvoie la
 * dernière réponse (même en erreur, l'appelant la traite) ou relance la dernière erreur réseau. */
export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RequestOptions = {},
): Promise<Response> {
  const { retry = true } = options;
  const max = retry ? policy.delaysMs.length : 0;
  let counted = false;
  try {
    for (let i = 0; ; i += 1) {
      let response: Response | null = null;
      let failure: unknown = null;
      try {
        response = await attempt(input, init);
      } catch (error) {
        failure = error;
      }
      const transient = response ? await isTransientResponse(response) : true;
      if (response && !transient) return response;
      if (i >= max) {
        if (response) return response;
        throw failure;
      }
      if (!counted) {
        counted = true;
        waking += 1;
        emit();
      }
      await sleep(policy.delaysMs[i]);
    }
  } finally {
    if (counted) {
      waking -= 1;
      emit();
    }
  }
}
