/**
 * useBackendStatus — React hook that subscribes to the backend status store.
 */
import { useSyncExternalStore } from "react";
import { getBackendStatus, subscribeBackendStatus } from "../api/backendStatus";

export function useBackendStatus() {
  return useSyncExternalStore(subscribeBackendStatus, getBackendStatus, getBackendStatus);
}

export function useIsOffline() {
  return useBackendStatus() === "offline";
}
