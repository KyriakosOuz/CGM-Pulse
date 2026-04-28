/**
 * Dashboard.jsx — Main dashboard page (/). All components already exist.
 *
 * Props:
 *   campaignsHook: { data, loading, error, refresh } from useCampaigns
 *   onOpenReport: () => void
 *   onOpenChat: (prefill?: string) => void
 */
import { useState } from "react";
import KPICard from "../components/Dashboard/KPICard";
import BudgetPacingCard from "../components/Dashboard/BudgetPacingCard";
import PerformanceChart from "../components/Dashboard/PerformanceChart";
import CampaignTable from "../components/Dashboard/CampaignTable";
import CampaignCard from "../components/Dashboard/CampaignCard";
import { useAnalytics } from "../hooks/useAnalytics";

const MOBILE_PAGE_SIZE = 10;

function formatDate(str) {
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Dashboard({ campaignsHook }) {
  const { data, loading, error, refresh } = campaignsHook;
  const account = data?.account_summary || {};
  const campaigns = data?.campaigns || [];
  const lastUpdated = data?.last_updated || null;

  const [mobilePage, setMobilePage] = useState(1);

  const { history: analyticsData, loading: chartLoading } = useAnalytics("2026-02-01", "2026-03-03", lastUpdated);

  const chartData = analyticsData
    ? analyticsData.dates.map((date, i) => ({
        date: date.slice(5),
        Spend: analyticsData.account.spend?.[i] ?? 0,
        Clicks: analyticsData.account.clicks?.[i] ?? 0,
      }))
    : [];

  const kpiCards = [
    {
      label: "Avg. CPC",
      value: `$${Number(account.cpc || 0).toFixed(2)}`,
      target: "Target: < $5.00",
      trend: null,
      status: account.kpi_status?.cpc || "good",
    },
    {
      label: "CTR",
      value: `${Number(account.ctr || 0).toFixed(2)}%`,
      target: "Target: > 0.65%",
      trend: null,
      status: account.kpi_status?.ctr || "good",
    },
    {
      label: "Cost Per Lead",
      value: `$${Number(account.cpl || 0).toFixed(2)}`,
      target: "Target: < $120",
      trend: null,
      status: account.kpi_status?.cpl || "good",
    },
    {
      label: "Conv. Rate",
      value: `${Number(account.conv_rate || 0).toFixed(2)}%`,
      target: "Target: > 1.00%",
      trend: null,
      status: account.kpi_status?.conv_rate || "good",
    },
  ];

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-4 text-sm text-error">
          Failed to load data: {error}.{" "}
          <button onClick={refresh} className="underline">
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {kpiCards.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </section>
      {data?.account_summary?.date_from && (
        <p className="text-[10px] text-outline text-right -mt-4">
          Data period: {formatDate(data.account_summary.date_from)} – {formatDate(data.account_summary.date_to)}
        </p>
      )}

      {/* Middle row */}
      <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2">
          <BudgetPacingCard campaigns={campaigns} datePeriod={data?.account_summary} lastUpdated={lastUpdated} />
        </div>
        <div className="xl:col-span-3">
          <PerformanceChart history={chartData} loading={chartLoading} />
        </div>
      </section>

      {/* Campaign table (desktop) */}
      <div className="hidden lg:block">
        <CampaignTable campaigns={campaigns} loading={loading} />
      </div>

      {/* Campaign cards (mobile) — paginated */}
      <div className="lg:hidden space-y-3">
        <h2 className="text-lg font-bold font-headline px-1">All Campaigns</h2>
        {loading ? (
          <p className="text-on-surface-variant text-sm px-1">Loading...</p>
        ) : (
          <>
            {campaigns.slice((mobilePage - 1) * MOBILE_PAGE_SIZE, mobilePage * MOBILE_PAGE_SIZE).map((c) => (
              <CampaignCard key={c.name} campaign={c} />
            ))}
            {campaigns.length > MOBILE_PAGE_SIZE && (
              <div className="flex items-center justify-between px-1 pt-2">
                <button
                  onClick={() => setMobilePage((p) => Math.max(1, p - 1))}
                  disabled={mobilePage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
                >
                  Prev
                </button>
                <span className="text-xs text-on-surface-variant">
                  {mobilePage} / {Math.ceil(campaigns.length / MOBILE_PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setMobilePage((p) => Math.min(Math.ceil(campaigns.length / MOBILE_PAGE_SIZE), p + 1))}
                  disabled={mobilePage === Math.ceil(campaigns.length / MOBILE_PAGE_SIZE)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
