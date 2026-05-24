/**
 * backendStatus — Module-level subscriber store for backend reachability.
 * Updated by axios interceptors and the streaming fetch helpers in client.js.
 */

let status = "unknown"; // 'unknown' | 'online' | 'offline'
const listeners = new Set();

export function getBackendStatus() {
  return status;
}

export function setBackendStatus(next) {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l());
}

export function subscribeBackendStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
