/**
 * CampaignDetailRow — Expanded row showing 7-day sparklines + full KPI breakdown.
 */

function formatDate(str) {
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const KPI_DEFS = [
  { key: "cpc", label: "CPC", format: (v) => `$${Number(v).toFixed(2)}`, target: "< $5.00", lowerGood: true },
  { key: "ctr", label: "CTR", format: (v) => `${Number(v).toFixed(2)}%`, target: "> 0.65%", lowerGood: false },
  { key: "cpl", label: "CPL", format: (v) => `$${Number(v).toFixed(2)}`, target: "< $120", lowerGood: true },
  { key: "conv_rate", label: "Conv Rate", format: (v) => `${Number(v).toFixed(2)}%`, target: "> 1.00%", lowerGood: false },
  { key: "total_spent", label: "Total Spend", format: (v) => `$${Number(v).toLocaleString()}`, target: "", lowerGood: null },
  { key: "leads", label: "Leads", format: (v) => String(v), target: "", lowerGood: null },
];

const SPARKLINE_DEFS = [
  { key: "cpc", label: "CPC", prefix: "$", suffix: "", targetVal: 5.0, good: "below" },
  { key: "ctr", label: "CTR", prefix: "", suffix: "%", targetVal: 0.65, good: "above" },
  { key: "cpl", label: "CPL", prefix: "$", suffix: "", targetVal: 120, good: "below" },
  { key: "conv_rate", label: "Conv", prefix: "", suffix: "%", targetVal: 1.0, good: "above" },
];

function TrendSparkline({ data, label, prefix, suffix, targetVal, good }) {
  const values = (data || []).filter((v) => v > 0);
  if (values.length < 2) {
    return (
      <div className="bg-surface-container-high rounded-xl p-3">
        <span className="text-[10px] text-outline uppercase tracking-wider font-medium">{label}</span>
        <p className="text-[10px] text-outline-variant mt-2">Not enough data</p>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const latest = values[values.length - 1];
  const first = values[0];
  const change = ((latest - first) / (first || 1)) * 100;

  const isGood = good === "below" ? latest < targetVal : latest > targetVal;
  const isTrendGood = good === "below" ? change < 0 : change > 0;

  const w = 200;
  const h = 48;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lineColor = isGood ? "#ecc15c" : "#ffb4ab";
  const lastY = h - ((latest - min) / range) * (h - 4) - 2;
  const gradId = `grad-${label}`;

  return (
    <div className="bg-surface-container-high rounded-xl p-3 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-outline uppercase tracking-wider font-medium">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-medium ${isTrendGood ? "text-tertiary" : "text-error"}`}>
            {isTrendGood ? (good === "below" ? "\u2193" : "\u2191") : good === "below" ? "\u2191" : "\u2193"}
            {Math.abs(change).toFixed(1)}%
          </span>
          <span className={`text-sm font-bold ${isGood ? "text-tertiary" : "text-error"}`}>
            {prefix}
            {latest >= 1000 ? latest.toLocaleString("en-US", { maximumFractionDigits: 0 }) : latest.toFixed(2)}
            {suffix}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: "48px" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={`0,${h} ${points} ${w},${h}`} fill={`url(#${gradId})`} stroke="none" />
        <polyline points={points} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={w} cy={lastY.toFixed(1)} r="2.5" fill={lineColor} />
      </svg>
      <div className="flex justify-between text-[9px] text-outline">
        <span>7 days ago</span>
        <span>today</span>
      </div>
    </div>
  );
}

export default function CampaignDetailRow({ campaign, history, historyLoading, onAskClaude }) {
  const recentHistory = (history?.history || []).slice(-7);

  return (
    <div className="bg-surface-container-low rounded-xl p-5 mt-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 2x2 Sparkline grid */}
      <div>
        <p className="text-[10px] uppercase text-outline tracking-widest font-medium mb-2">7-Day Trends</p>
        {historyLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-surface-container-high animate-pulse" />
            ))}
          </div>
        ) : recentHistory.length >= 2 ? (
          <div className="grid grid-cols-2 gap-2">
            {SPARKLINE_DEFS.map((s) => (
              <TrendSparkline
                key={s.key}
                label={s.label}
                prefix={s.prefix}
                suffix={s.suffix}
                targetVal={s.targetVal}
                good={s.good}
                data={recentHistory.map((r) => r[s.key] || 0)}
              />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-outline-variant">No trend data available</p>
        )}
      </div>

      {/* KPI breakdown */}
      <div className="lg:col-span-1">
        <p className="text-[10px] uppercase text-outline tracking-widest mb-3">KPI Breakdown</p>
        {campaign.date_from && campaign.date_to && (
          <div className="flex justify-between text-[11px] pb-3 mb-3 border-b border-outline-variant/10">
            <span className="text-outline uppercase tracking-wider">Data Period</span>
            <span className="text-on-surface-variant">
              {formatDate(campaign.date_from)} – {formatDate(campaign.date_to)}
            </span>
          </div>
        )}
        <div className="space-y-2">
          {KPI_DEFS.map(({ key, label, format, target }) => {
            const val = campaign[key] || 0;
            const status = campaign.kpi_status?.[key];
            const statusColor =
              status === "good" ? "text-tertiary" : status === "bad" ? "text-error" : "text-on-surface";

            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">{label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${statusColor}`}>{format(val)}</span>
                  {target && <span className="text-[9px] text-outline">{target}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pacing + Ask Claude */}
      <div>
        <p className="text-[10px] uppercase text-outline tracking-widest mb-3">Budget Pacing</p>
        {campaign.pacing ? (
          <div className="space-y-1 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-on-surface-variant">Spent</span>
              <span className="font-semibold">${Number(campaign.pacing.spent || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-on-surface-variant">Budget Est.</span>
              <span className="font-semibold">${Number(campaign.pacing.budget_estimate || 0).toLocaleString()}</span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full mt-2">
              <div
                className={`h-full rounded-full transition-all
                  ${campaign.pacing.status === "ON TRACK" ? "bg-tertiary" :
                    campaign.pacing.status === "OVERPACING" ? "bg-error" : "bg-primary"}`}
                style={{ width: `${Math.min(campaign.pacing.pacing_percent || 0, 100)}%` }}
              />
            </div>
            <p className={`text-[10px] font-bold uppercase mt-1
              ${campaign.pacing.status === "ON TRACK" ? "text-tertiary" :
                campaign.pacing.status === "OVERPACING" ? "text-error" : "text-primary"}`}>
              {campaign.pacing.status}
            </p>
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant mb-4">No pacing data</p>
        )}

        <button
          onClick={() => onAskClaude(campaign.name)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">auto_awesome</span>
          Ask Claude about this campaign
        </button>
      </div>
    </div>
  );
}
