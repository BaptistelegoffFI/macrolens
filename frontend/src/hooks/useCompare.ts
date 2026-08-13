import { useCallback, useState } from "react";

import { ApiError } from "../api/client";
import { compareEpisodes } from "../api/endpoints";
import type { CompareResponse, EpisodePair } from "../api/types";

export function useCompare() {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (pairs: EpisodePair[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await compareEpisodes({ pairs });
      setData(result);
      setLoading(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? typeof err.detail === "string"
            ? err.detail
            : ((err.detail as { detail?: string })?.detail ?? err.message)
          : err instanceof Error
            ? err.message
            : "Erreur inconnue";
      setData(null);
      setError(message);
      setLoading(false);
    }
  }, []);

  return { data, loading, error, run };
}
