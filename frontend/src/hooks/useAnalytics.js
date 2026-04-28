/**
 * useAnalytics — Prefetches all date-range periods in parallel on mount.
 * Provides instant switching between periods from cache.
 *
 * Module-level cache persists across tab navigation. Pass lastUpdated
 * (from the campaigns API) to invalidate when Sheet data changes.
 */
import { useState, useEffect, useRef } from "react";
import { fetchDateRangeHistory } from "../api/client";

// Sheet data boundaries — update when Sheet gets live data
const SHEET_END = "2026-03-03";
const SHEET_START = "2026-01-01";

export const ANALYTICS_PERIODS = [
  { key: "7d",    label: "Last 7 Days",  from: "2026-02-24", to: SHEET_END },
  { key: "30d",   label: "Last 30 Days", from: "2026-02-01", to: SHEET_END },
  { key: "month", label: "This Month",   from: "2026-03-01", to: SHEET_END },
  { key: "all",   label: "All Time",     from: SHEET_START,  to: SHEET_END },
];

// Module-level cache: survives component unmount/remount (tab navigation)
const _analyticsCache = new Map();
let _analyticsCacheVersion = null;

function getCacheKey(from, to) { return `${from}|${to}`; }

export function useAnalytics(from, to, lastUpdated) {
  const key = getCacheKey(from, to);
  const cached = _analyticsCache.get(key);

  // Invalidate cache when data source changes
  if (lastUpdated && _analyticsCacheVersion && _analyticsCacheVersion !== lastUpdated) {
    _analyticsCache.clear();
    _analyticsCacheVersion = lastUpdated;
  } else if (lastUpdated && !_analyticsCacheVersion) {
    _analyticsCacheVersion = lastUpdated;
  }

  const [history, setHistory] = useState(cached || null);
  const [loading, setLoading] = useState(!cached);
  const hasFetched = useRef(!!cached);

  useEffect(() => {
    // If cache was invalidated, re-check
    const current = _analyticsCache.get(key);
    if (current) {
      setHistory(current);
      setLoading(false);
      return;
    }
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchDateRangeHistory(from, to)
      .then((data) => {
        _analyticsCache.set(key, data);
        setHistory(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to, lastUpdated]);

  return { history, loading };
}

// Module-level cache for prefetched periods
const _prefetchCache = {};
let _prefetchCacheVersion = null;

export function useAnalyticsPrefetch(lastUpdated) {
  // Invalidate if data source changed
  if (lastUpdated && _prefetchCacheVersion && _prefetchCacheVersion !== lastUpdated) {
    Object.keys(_prefetchCache).forEach((k) => delete _prefetchCache[k]);
    _prefetchCacheVersion = lastUpdated;
  } else if (lastUpdated && !_prefetchCacheVersion) {
    _prefetchCacheVersion = lastUpdated;
  }

  const alreadyCached = ANALYTICS_PERIODS.every((p) => _prefetchCache[p.label]);

  const [cache, setCache] = useState(() => ({ ..._prefetchCache }));
  const [loadingPeriods, setLoadingPeriods] = useState(
    () => new Set(alreadyCached ? [] : ANALYTICS_PERIODS.filter((p) => !_prefetchCache[p.label]).map((p) => p.label))
  );
  const [errors, setErrors] = useState({});
  const hasFetched = useRef(alreadyCached);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    ANALYTICS_PERIODS.forEach(async (period) => {
      if (_prefetchCache[period.label]) {
        setCache((prev) => ({ ...prev, [period.label]: _prefetchCache[period.label] }));
        setLoadingPeriods((prev) => { const next = new Set(prev); next.delete(period.label); return next; });
        return;
      }
      try {
        const data = await fetchDateRangeHistory(period.from, period.to);
        _prefetchCache[period.label] = data;
        setCache((prev) => ({ ...prev, [period.label]: data }));
      } catch (e) {
        setErrors((prev) => ({ ...prev, [period.label]: e.message }));
      } finally {
        setLoadingPeriods((prev) => {
          const next = new Set(prev);
          next.delete(period.label);
          return next;
        });
      }
    });
  }, [lastUpdated]);

  return {
    getHistory: (label) => cache[label] || _prefetchCache[label] || null,
    isLoading: (label) => loadingPeriods.has(label),
    isAllLoaded: () => loadingPeriods.size === 0,
    getLoadingProgress: () => ({
      loaded: ANALYTICS_PERIODS.length - loadingPeriods.size,
      total: ANALYTICS_PERIODS.length,
    }),
    errors,
  };
}
