import { useEffect, useState } from "react";

import { getAssetReturns } from "../api/endpoints";
import type { AssetReturnsResponse } from "../api/types";

export interface AssetReturnsState {
  data: AssetReturnsResponse | null;
  loading: boolean;
  /** Message d'erreur : jamais bloquant, la page qui l'affiche continue de fonctionner. */
  error: string | null;
}

const HORIZONS = [1, 3, 5, 10];

/** Une réponse qui n'a pas la forme du contrat versionné (proxy, dérive d'API,
 * autre endpoint) est traitée comme une erreur : jamais passée au rendu. */
export function isAssetReturnsResponse(value: unknown): value is AssetReturnsResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<AssetReturnsResponse>;
  return (
    typeof v.schema_version === "string" &&
    v.schema_version.startsWith("asset-returns/") &&
    Array.isArray(v.classes) &&
    Array.isArray(v.forward_paths)
  );
}

/** Charge les rendements d'actifs des analogues d'une recherche réussie. Toute
 * erreur (réseau, 503, schéma inattendu) reste confinée à cet état : aucune autre
 * partie de l'interface n'en dépend (ADR 0024, dégradation gracieuse). */
export function useAssetReturns(analogs: { country: string; year: number }[] | null) {
  const [state, setState] = useState<AssetReturnsState>({ data: null, loading: false, error: null });
  const key = analogs ? analogs.map((a) => `${a.country}:${a.year}`).join(",") : "";

  useEffect(() => {
    if (!analogs || analogs.length === 0) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    getAssetReturns({ analogs, horizons: HORIZONS })
      .then((data) => {
        if (cancelled) return;
        if (isAssetReturnsResponse(data)) setState({ data, loading: false, error: null });
        else setState({ data: null, loading: false, error: "unexpected response shape" });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // `key` résume `analogs` : évite de relancer l'appel quand la liste est recréée à l'identique.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
