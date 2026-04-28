/**
 * useCampaigns — Fetches campaign data on mount and refreshes every 60 seconds.
 */
import { useState, useEffect, useCallback } from "react";
import { fetchCampaigns } from "../api/client";

export function useCampaigns() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchCampaigns();
      setData(result);
    } catch (e) {
      setError(e.message || "Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  return { data, loading, error, refresh: load };
}
