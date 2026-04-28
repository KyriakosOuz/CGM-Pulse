/**
 * DataSettings — Sync controls and data source info.
 */
import { useState, useEffect } from "react";
import { fetchSyncStatus, triggerFullSync } from "../../api/client";

const REFRESH_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
];

export default function DataSettings({ onRefresh }) {
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [refreshInterval, setRefreshInterval] = useState(60);

  useEffect(() => {
    fetchSyncStatus().then(setSyncStatus).catch(() => {});
  }, []);

  async function handleFullSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const result = await triggerFullSync();
      setSyncMsg(`Sync complete — ${result.vectors_upserted} vectors upserted.`);
      const updated = await fetchSyncStatus();
      setSyncStatus(updated);
    } catch {
      setSyncMsg("Sync failed. Check backend logs.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="bg-surface-container rounded-xl p-6 space-y-5">
      <h3 className="font-headline text-base font-bold">Data Settings</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Google Sheet", value: "1bkmvmK…8mBK3w", icon: "table_chart" },
          { label: "Last Synced", value: syncStatus?.last_synced ? new Date(syncStatus.last_synced).toLocaleString() : "Never", icon: "sync" },
          { label: "Pinecone Vectors", value: syncStatus?.total_vectors?.toLocaleString() ?? "—", icon: "database" },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-surface-container-high rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-outline text-base">{icon}</span>
              <span className="text-[10px] uppercase text-outline tracking-widest">{label}</span>
            </div>
            <p className="text-sm font-semibold text-on-surface font-mono truncate">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs text-on-surface-variant block mb-2">Auto-refresh interval</label>
        <div className="flex items-center gap-2">
          {REFRESH_OPTIONS.map(({ value, label }) => (
            <button key={value} onClick={() => setRefreshInterval(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${refreshInterval === value ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:text-on-surface"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleFullSync} disabled={syncing}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary-container rounded-xl text-sm font-semibold disabled:opacity-50">
          <span className={`material-symbols-outlined text-base ${syncing ? "animate-spin" : ""}`}>sync</span>
          {syncing ? "Syncing..." : "Force Full Sync"}
        </button>
        <button onClick={onRefresh}
          className="flex items-center gap-2 px-5 py-2.5 border border-outline-variant/20 text-sm font-semibold text-on-surface-variant rounded-xl hover:bg-surface-container-high hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-base">refresh</span>
          Refresh Dashboard
        </button>
      </div>
      {syncMsg && <p className="text-xs text-on-surface-variant">{syncMsg}</p>}
    </div>
  );
}
