const STORAGE_KEY = "ml.clientId";

/** Identifiant anonyme d'appareil pour le dashboard analytics admin
 * (§ADR 0011) : un UUID v4 généré une seule fois et conservé en
 * localStorage, jamais une adresse IP ni une donnée personnelle. */
export function getClientId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}
