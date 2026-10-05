import { useSyncExternalStore } from "react";

import { isWaking, subscribeWaking } from "../api/resilience";

/** Vrai tant qu'une requête réessaie après un échec transitoire (réveil du serveur, ADR 0027). */
export function useServerWaking(): boolean {
  return useSyncExternalStore(subscribeWaking, isWaking, () => false);
}
