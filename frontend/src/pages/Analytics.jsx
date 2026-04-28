/**
 * Analytics.jsx — Analytics page (/analytics).
 * Date-range filtered KPI trends + comparison chart + performers table.
 * All periods prefetched in parallel on mount for instant switching.
 *
 * Props:
 *   campaignsHook: { data, loading, error } from useCampaigns
 */
import { useState, useEffect } from "react";
import PageHeader from "../components/Shared/PageHeader";
import TrendKPICard from "../components/Analytics/TrendKPICard";
import ComparisonChart from "../components/Analytics/ComparisonChart";
import PerformersTable from "../components/Analytics/PerformersTable";
import EmptyState from "../components/Shared/EmptyState";
import { useAnalyticsPrefetch, ANALYTICS_PERIODS } from "../hooks/useAnalytics";

export default function Analytics({ campaignsHook }) {
  const { data: campaignData, loading: campaignsLoading } = campaignsHook;
  const campaigns = campaignData?.campaigns || [];

  // Default to "Last 30 Days" (index 1)
  const [activePeriod, setActivePeriod] = useState(ANALYTICS_PERIODS[1]);
  const { getHistory, isLoading, isAllLoaded, getLoadingProgress } = useAnalyticsPrefetch(campaignData?.last_updated);

  const historyData = getHistory(activePeriod.label);
  const historyLoading = isLoading(activePeriod.label);
  const { loaded, total } = getLoadingProgress();

  const [selectedCampaigns, setSelectedCampaigns] = useState([]);
  const [chartMetric, setChartMetric] = useState("cpc");
  const [tableMetric, setTableMetric] = useState("cpc");

  // Auto-select interesting campaigns that have data in the current date range
  useEffect(() => {
    if (!campaigns.length || !historyData?.campaigns) return;

    const withData = campaigns.filter((c) => {
      const vals = historyData.campaigns?.[c.name];
      return vals?.[chartMetric]?.some((v) => v > 0);
    });

    const byCPC = [...withData]
      .filter((c) => c.clicks > 0)
      .sort((a, b) => (a.cpc || 0) - (b.cpc || 0));

    const best = byCPC.slice(0, 2).map((c) => c.name);
    const worst = byCPC.slice(-1).map((c) => c.name);
    setSelectedCampaigns([...new Set([...best, ...worst])]);
  }, [historyData]);

  function toggleCampaign(name) {
    setSelectedCampaigns((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name].slice(0, 5)
    );
  }

  const account = historyData?.account || {};
  const summary = historyData?.summary || {};
  const kpiCards = [
    {
      label: "Avg. CPC",
      value: `$${Number(summary.cpc || 0).toFixed(2)}`,
      target: "Target: < $5.00",
      status: summary.kpi_status?.cpc || "bad",
      sparkData: account.cpc || [],
    },
    {
      label: "CTR",
      value: `${Number(summary.ctr || 0).toFixed(2)}%`,
      target: "Target: > 0.65%",
      status: summary.kpi_status?.ctr || "bad",
      sparkData: account.ctr || [],
    },
    {
      label: "Cost Per Lead",
      value: `$${Number(summary.cpl || 0).toFixed(2)}`,
      target: "Target: < $120",
      status: summary.kpi_status?.cpl || "bad",
      sparkData: account.cpl || [],
    },
    {
      label: "Conv. Rate",
      value: `${Number(summary.conv_rate || 0).toFixed(2)}%`,
      target: "Target: > 1.00%",
      status: summary.kpi_status?.conv_rate || "bad",
      sparkData: account.conv_rate || [],
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        subtitle="Date-filtered performance trends across all campaigns"
      />

      {/* Date range pills */}
      <div>
        <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1 w-fit">
          {ANALYTICS_PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setActivePeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5
                ${activePeriod.key === p.key
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              {p.label}
              {isLoading(p.label) ? (
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant animate-pulse" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary/60" />
              )}
            </button>
          ))}
        </div>

        {/* Loading progress */}
        {!isAllLoaded() && (
          <div className="flex items-center gap-2 mt-2 max-w-xs">
            <div className="flex-1 h-0.5 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/40 rounded-full transition-all duration-500"
                style={{ width: `${(loaded / total) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-outline shrink-0">
              Loading {loaded}/{total} periods
            </span>
          </div>
        )}

        <p className="text-[10px] text-outline mt-2">
          Available data: Jan 1, 2026 – Mar 3, 2026
        </p>
        {activePeriod.key === "month" && (historyData?.dates?.length || 0) < 7 && historyData?.dates?.length > 0 && (
          <p className="text-[11px] text-outline bg-surface-container rounded-lg px-3 py-2 mt-2">
            Only {historyData.dates.length} days of data available for March 2026 (Mar 1–3). Charts may appear sparse.
          </p>
        )}
      </div>

      {/* KPI trend cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {kpiCards.map((kpi) => (
          <TrendKPICard key={kpi.label} {...kpi} />
        ))}
      </section>

      {/* Comparison chart */}
      {campaigns.length === 0 && !campaignsLoading ? (
        <EmptyState
          icon="bar_chart"
          title="No campaign data"
          message="Data will appear once campaigns are loaded from the Google Sheet."
        />
      ) : (
        <ComparisonChart
          historyData={historyData}
          selectedCampaigns={selectedCampaigns}
          onToggleCampaign={toggleCampaign}
          metric={chartMetric}
          onMetricChange={setChartMetric}
          loading={historyLoading}
        />
      )}

      {/* Top/Bottom performers */}
      <PerformersTable
        campaigns={campaigns}
        metric={tableMetric}
        onMetricChange={setTableMetric}
      />
    </div>
  );
}
