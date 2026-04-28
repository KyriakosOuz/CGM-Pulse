/**
 * ComparisonChart — Multi-line chart comparing campaigns over a date range.
 * Campaign selector with search, sorted selected-first, max 5 at once.
 */
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const CAMPAIGN_COLORS = ["#d0bcff", "#ecc15c", "#ffb4ab", "#bfaddd", "#a8c5da"];
const METRICS = [
  { key: "cpc", label: "CPC ($)" },
  { key: "ctr", label: "CTR (%)" },
  { key: "cpl", label: "CPL ($)" },
  { key: "conv_rate", label: "Conv Rate (%)" },
];

const CustomTooltip = ({ active, payload, label, metric }) => {
  if (!active || !payload?.length) return null;
  const isPercent = metric === "ctr" || metric === "conv_rate";
  const prefix = metric === "cpc" || metric === "cpl" ? "$" : "";
  const suffix = isPercent ? "%" : "";
  return (
    <div className="bg-surface-container-highest border border-outline-variant/20 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-on-surface-variant mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.dataKey.length > 30 ? p.dataKey.slice(0, 30) + "\u2026" : p.dataKey}: {prefix}{Number(p.value).toFixed(2)}{suffix}
        </p>
      ))}
    </div>
  );
};

export default function ComparisonChart({ historyData, selectedCampaigns, onToggleCampaign, metric, onMetricChange, loading = false }) {
  const dates = historyData?.dates || [];
  const campaignsData = historyData?.campaigns || {};
  const [selectorSearch, setSelectorSearch] = useState("");

  // All campaigns with actual data for this metric
  const allCampaignNames = Object.keys(campaignsData)
    .filter((name) => campaignsData[name]?.[metric]?.some((v) => v > 0))
    .sort((a, b) => {
      const aSelected = selectedCampaigns.includes(a);
      const bSelected = selectedCampaigns.includes(b);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });

  // Filter by search, but always show selected campaigns
  const filteredUnselected = allCampaignNames
    .filter((n) => !selectedCampaigns.includes(n) && n.toLowerCase().includes(selectorSearch.toLowerCase()));

  const visibleCampaigns = [
    ...allCampaignNames.filter((n) => selectedCampaigns.includes(n)),
    ...filteredUnselected.slice(0, 20 - selectedCampaigns.length),
  ];

  // Only chart selected campaigns that have non-zero data for this metric
  const activeCampaigns = selectedCampaigns.filter((name) =>
    campaignsData[name]?.[metric]?.some((v) => v > 0)
  );
  const campaignsWithNoData = selectedCampaigns.filter((name) =>
    !campaignsData[name]?.[metric]?.some((v) => v > 0)
  );

  const chartData = dates.map((date, i) => {
    const entry = { date: date.slice(5) };
    activeCampaigns.forEach((name) => {
      if (campaignsData[name]?.[metric]?.[i] != null) {
        entry[name] = campaignsData[name][metric][i];
      }
    });
    return entry;
  });

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h4 className="font-headline text-lg font-bold">Campaign Comparison</h4>
        <div className="flex items-center gap-1 bg-surface-container-high rounded-xl p-1">
          {METRICS.map((m) => (
            <button key={m.key} onClick={() => onMetricChange(m.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${metric === m.key ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:text-on-surface"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign search */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search campaigns to compare..."
          value={selectorSearch}
          onChange={(e) => setSelectorSearch(e.target.value)}
          className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-outline border border-outline-variant/10 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      <p className="text-[10px] text-outline mb-3">
        Click to toggle campaigns (max 5 at once). {selectedCampaigns.length}/5 selected
      </p>

      {/* Campaign selector pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {visibleCampaigns.map((name) => {
          const isSelected = selectedCampaigns.includes(name);
          const color = isSelected ? CAMPAIGN_COLORS[selectedCampaigns.indexOf(name)] || "#d0bcff" : "#4a4452";
          return (
            <button
              key={name}
              onClick={() => onToggleCampaign(name)}
              disabled={!isSelected && selectedCampaigns.length >= 5}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-all
                ${isSelected
                  ? "border-transparent text-white"
                  : "border-outline-variant/20 text-outline-variant opacity-50 hover:opacity-75 disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              style={isSelected ? { background: color + "30", borderColor: color + "60", color } : {}}
              title={name}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: isSelected ? color : "#4a4452" }} />
              <span className="truncate max-w-[160px]">
                {name.length > 35 ? name.slice(0, 35) + "\u2026" : name}
              </span>
            </button>
          );
        })}
        {filteredUnselected.length > 20 - selectedCampaigns.length && (
          <span className="text-[10px] text-outline self-center">
            +{filteredUnselected.length - (20 - selectedCampaigns.length)} more (search to find)
          </span>
        )}
      </div>

      {campaignsWithNoData.length > 0 && (
        <p className="text-[11px] text-outline mb-2">
          {campaignsWithNoData.length} selected campaign(s) have no data for this period and are hidden from the chart.
        </p>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-on-surface-variant text-sm">Loading chart data...</div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-on-surface-variant text-sm">No data for selected date range.</div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 320 }}>
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4a4452" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fill: "#958e9d", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#958e9d", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip metric={metric} />} />
                {activeCampaigns.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={CAMPAIGN_COLORS[i] || "#d0bcff"} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
