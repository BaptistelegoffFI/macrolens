import { useCallback, useState } from "react";

import { ApiError } from "../api/client";
import { getEpisode } from "../api/endpoints";
import type { EpisodeOut } from "../api/types";

export interface EpisodeState {
  data: EpisodeOut | null;
  loading: boolean;
  error: string | null;
}

export function useEpisode() {
  const [state, setState] = useState<EpisodeState>({ data: null, loading: false, error: null });

  const run = useCallback(async (country: string, year: number) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await getEpisode(country, year);
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? typeof err.detail === "string"
            ? err.detail
            : ((err.detail as { detail?: string })?.detail ?? err.message)
          : err instanceof Error
            ? err.message
            : "Erreur inconnue";
      setState({ data: null, loading: false, error: message });
    }
  }, []);

  return { ...state, run };
}
