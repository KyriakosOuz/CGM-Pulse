/**
 * PerformersTable — Shows top 5 and bottom 5 campaigns for a selected KPI.
 */
import { useState } from "react";
import KPIBadge from "../Shared/KPIBadge";

const METRICS = [
  { key: "cpc", label: "CPC", lowerIsBetter: true, format: (v) => `$${Number(v).toFixed(2)}` },
  { key: "ctr", label: "CTR", lowerIsBetter: false, format: (v) => `${Number(v).toFixed(2)}%` },
  { key: "cpl", label: "CPL", lowerIsBetter: true, format: (v) => `$${Number(v).toFixed(2)}` },
  { key: "conv_rate", label: "Conv Rate", lowerIsBetter: false, format: (v) => `${Number(v).toFixed(2)}%` },
];

function CampaignName({ name }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="relative flex-1 min-w-0">
      <span
        className="block truncate cursor-default text-xs font-medium text-on-surface"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {name}
      </span>
      {showTooltip && (
        <div className="absolute left-0 top-6 z-50 bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-xs text-on-surface shadow-xl max-w-[400px] whitespace-normal pointer-events-none">
          {name}
        </div>
      )}
    </div>
  );
}

function CampaignRankRow({ rank, campaign, metricConfig }) {
  const rawVal = campaign[metricConfig.key] || 0;
  const status = campaign.kpi_status?.[metricConfig.key] || "bad";
  return (
    <div className="flex items-center gap-3 py-3 border-b border-outline-variant/5 last:border-0">
      <span className="w-6 text-right shrink-0 text-xs font-bold text-on-surface-variant">{rank}</span>
      <CampaignName name={campaign.name} />
      <KPIBadge value={metricConfig.format(rawVal)} status={status} />
    </div>
  );
}

export default function PerformersTable({ campaigns = [], metric, onMetricChange }) {
  const metricConfig = METRICS.find((m) => m.key === metric) || METRICS[0];

  const sorted = [...campaigns]
    .filter((c) => c[metric] != null && c[metric] > 0)
    .sort((a, b) =>
      metricConfig.lowerIsBetter ? a[metric] - b[metric] : b[metric] - a[metric]
    );

  const top5 = sorted.slice(0, 5);
  const bottom5 = [...sorted].reverse().slice(0, 5);

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h4 className="font-headline text-lg font-bold">Top & Bottom Performers</h4>
        <div className="flex items-center gap-1 bg-surface-container-high rounded-xl p-1">
          {METRICS.map((m) => (
            <button key={m.key} onClick={() => onMetricChange(m.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${metric === m.key ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:text-on-surface"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] text-tertiary uppercase tracking-widest font-bold mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            Top 5 — {metricConfig.label}
          </p>
          {top5.length === 0 ? (
            <p className="text-on-surface-variant text-xs">No data</p>
          ) : (
            top5.map((c, i) => <CampaignRankRow key={c.name} rank={i + 1} campaign={c} metricConfig={metricConfig} />)
          )}
        </div>
        <div>
          <p className="text-[10px] text-error uppercase tracking-widest font-bold mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">trending_down</span>
            Bottom 5 — {metricConfig.label}
          </p>
          {bottom5.length === 0 ? (
            <p className="text-on-surface-variant text-xs">No data</p>
          ) : (
            bottom5.map((c, i) => <CampaignRankRow key={c.name} rank={i + 1} campaign={c} metricConfig={metricConfig} />)
          )}
        </div>
      </div>
    </div>
  );
}
