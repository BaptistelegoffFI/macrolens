import { useCallback, useState } from "react";

import { ApiError } from "../api/client";
import { searchAnalogs } from "../api/endpoints";
import type { AnalogsSearchRequest, AnalogsSearchResponse } from "../api/types";
import { logSearch } from "../lib/usageLog";

export interface AnalogsSearchState {
  data: AnalogsSearchResponse | null;
  loading: boolean;
  error: string | null;
  elapsedMs: number | null;
}

export function useAnalogsSearch() {
  const [state, setState] = useState<AnalogsSearchState>({
    data: null,
    loading: false,
    error: null,
    elapsedMs: null,
  });

  const run = useCallback(async (request: AnalogsSearchRequest) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const start = performance.now();
    try {
      const data = await searchAnalogs(request);
      setState({ data, loading: false, error: null, elapsedMs: performance.now() - start });
      logSearch(request);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? typeof err.detail === "string"
            ? err.detail
            : ((err.detail as { detail?: string })?.detail ?? err.message)
          : err instanceof Error
            ? err.message
            : "Erreur inconnue";
      setState({ data: null, loading: false, error: message, elapsedMs: null });
    }
  }, []);

  return { ...state, run };
}
