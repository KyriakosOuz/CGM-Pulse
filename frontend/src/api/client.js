/**
 * api/client.js — Axios instance and all API call functions.
 * Base URL is set from VITE_API_URL environment variable.
 */
import axios from "axios";
import { setBackendStatus } from "./backendStatus";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Mirror reachability into the global backend-status store so the
// BackendStatusBanner / OfflineTooltip wrappers can react.
api.interceptors.response.use(
  (res) => {
    setBackendStatus("online");
    return res;
  },
  (err) => {
    // No `response` means the request never reached the server (network error,
    // DNS, CORS preflight failure, timeout). Treat that as offline.
    if (!err.response) setBackendStatus("offline");
    else setBackendStatus("online");
    return Promise.reject(err);
  }
);

/**
 * Fetch all campaigns with KPI data.
 * @returns {Promise<{account_summary, campaigns, last_updated}>}
 */
export async function fetchCampaigns() {
  const { data } = await api.get("/api/campaigns");
  return data;
}

/**
 * Invalidate the server-side campaign cache so the next fetch is fresh.
 */
export async function invalidateCache() {
  await api.post("/api/campaigns/refresh");
}

/**
 * Fetch day-by-day history for one campaign.
 * @param {string} name - Campaign name
 * @returns {Promise<{campaign, history}>}
 */
export async function fetchCampaignHistory(name) {
  const { data } = await api.get(`/api/campaigns/${encodeURIComponent(name)}/history`);
  return data;
}

/**
 * Start a streaming AI report request.
 * Returns a Response object for SSE reading.
 * @returns {Promise<Response>}
 */
export async function startReportStream() {
  try {
    const res = await fetch(`${BASE_URL}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    setBackendStatus(res.ok ? "online" : res.status >= 500 ? "offline" : "online");
    return res;
  } catch (e) {
    setBackendStatus("offline");
    throw e;
  }
}

/**
 * Start a streaming chat response.
 * @param {string} question
 * @param {Array} history - conversation history
 * @returns {Promise<Response>}
 */
export async function startChatStream(question, history = []) {
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history }),
    });
    setBackendStatus(res.ok ? "online" : res.status >= 500 ? "offline" : "online");
    return res;
  } catch (e) {
    setBackendStatus("offline");
    throw e;
  }
}

/**
 * Fetch daily KPI history across all campaigns for a date range.
 * @param {string} from - "YYYY-MM-DD"
 * @param {string} to - "YYYY-MM-DD"
 * @returns {Promise<{ dates, account, campaigns }>}
 */
export async function fetchDateRangeHistory(from, to) {
  const { data } = await api.get("/api/analytics/history", { params: { from, to } });
  return data;
}

/**
 * Fetch current alert configuration from the backend.
 * @returns {Promise<{ email: string, slack_webhook: string, enabled: boolean }>}
 */
export async function fetchAlertConfig() {
  const { data } = await api.get("/api/alerts/config");
  return data;
}

/**
 * Save alert configuration.
 * @param {{ email: string|null, slack_webhook: string|null, enabled: boolean }} config
 */
export async function saveAlertConfig(config) {
  const { data } = await api.post("/api/alerts/config", config);
  return data;
}

/**
 * Trigger a test alert to verify email + Slack are working.
 * @returns {Promise<{ email_sent: boolean, slack_sent: boolean }>}
 */
export async function testAlert() {
  const { data } = await api.post("/api/alerts/test");
  return data;
}

/**
 * Save updated KPI targets.
 * @param {{ cpc: number, ctr: number, cpl: number, conv_rate: number }} targets
 */
export async function saveKPITargets(targets) {
  const { data } = await api.post("/api/settings/targets", targets);
  return data;
}

/**
 * Fetch Pinecone sync status.
 * @returns {Promise<{ last_synced: string, total_vectors: number, sheet_rows: number }>}
 */
export async function fetchSyncStatus() {
  const { data } = await api.get("/api/sync/status");
  return data;
}

/**
 * Trigger a full Pinecone sync manually.
 * @returns {Promise<{ status: string, vectors_upserted: number }>}
 */
export async function triggerFullSync() {
  const { data } = await api.post("/api/sync/full");
  return data;
}
