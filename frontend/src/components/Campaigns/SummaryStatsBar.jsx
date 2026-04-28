/**
 * SummaryStatsBar — Row of 4 stat pills showing campaign counts.
 */
export default function SummaryStatsBar({ campaigns = [] }) {
  const total = campaigns.length;
  const active = campaigns.filter((c) => c.status === "Active").length;
  const paused = campaigns.filter((c) => c.status === "Paused").length;
  const offTarget = campaigns.filter((c) => {
    const s = c.kpi_status || {};
    return Object.values(s).some((v) => v === "bad");
  }).length;

  const stats = [
    { label: "Total Campaigns", value: total, icon: "campaign" },
    { label: "Active", value: active, icon: "play_circle", color: "text-tertiary" },
    { label: "Paused", value: paused, icon: "pause_circle", color: "text-on-surface-variant" },
    { label: "Off Target", value: offTarget, icon: "warning", color: "text-error" },
  ];

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {stats.map(({ label, value, icon, color }) => (
        <div key={label} className="flex items-center gap-2.5 bg-surface-container px-4 py-2.5 rounded-full">
          <span className={`material-symbols-outlined text-base ${color || "text-on-surface"}`}>{icon}</span>
          <div className="flex items-center gap-1.5">
            <span className={`font-headline font-bold text-sm ${color || "text-on-surface"}`}>{value}</span>
            <span className="text-xs text-on-surface-variant">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
