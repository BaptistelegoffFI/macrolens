import { useCallback, useState } from "react";

import { provenance } from "../api/endpoints";
import type { ReceiptRequest, ReceiptResponse } from "../api/types";

export function useProvenanceReceipt() {
  const [data, setData] = useState<ReceiptResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (request: ReceiptRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await provenance.receipt(request);
      setData(result);
      setLoading(false);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }, []);

  return { data, loading, error, run };
}
