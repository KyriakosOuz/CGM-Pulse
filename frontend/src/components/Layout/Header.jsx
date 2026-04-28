/**
 * Header — Top navigation bar with branding, last-updated time, and action buttons.
 *
 * Props:
 *   lastUpdated: string — ISO timestamp
 *   onGenerateReport: () => void
 *   onRefresh: () => void
 *   campaigns: array — campaign objects for CSV export
 */
import { Link } from "react-router-dom";
import Logo from "../Shared/Logo";
import { invalidateCache } from "../../api/client";

function formatDate(str) {
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Header({ data, onGenerateReport, onRefresh, campaigns = [] }) {

  async function handleRefresh() {
    await invalidateCache();
    onRefresh();
  }

  function handleExport() {
    if (!campaigns?.length) return;

    const headers = [
      "Campaign Name", "Status", "Impressions", "Clicks",
      "CPC", "CTR", "CPL", "Conv Rate", "Total Spent"
    ];

    const fmt$ = (n) => {
      const num = Number(n);
      if (num >= 100) return `"$${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}"`;
      return `"$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`;
    };
    const rows = campaigns.map(c => [
      `"${c.name}"`,
      c.status,
      c.impressions,
      c.clicks,
      fmt$(c.cpc),
      `${Number(c.ctr).toFixed(2)}%`,
      fmt$(c.cpl),
      `${Number(c.conv_rate).toFixed(2)}%`,
      fmt$(c.total_spent)
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cgm-pulse-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <header className="flex justify-between items-center w-full pl-24 pr-8 py-4 sticky top-0 h-20 z-30 bg-background/80 backdrop-blur-md">
      <Link to="/" className="flex flex-col">
        <Logo size="lg" />
        <span className="text-[10px] text-outline mt-0.5 leading-none uppercase tracking-wide">
          LinkedIn Ads Intelligence
        </span>
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end mr-2">
          <p className="text-[11px] text-outline-variant">
            Sheet data through
          </p>
          <p className="text-[11px] text-on-surface font-medium">
            {data?.account_summary?.date_to
              ? formatDate(data.account_summary.date_to)
              : "Loading..."}
          </p>
          <button
            onClick={handleRefresh}
            className="text-[11px] text-primary hover:text-primary-fixed-dim transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[12px]">refresh</span>
            Refresh
          </button>
        </div>

        <button
          onClick={handleExport}
          className="px-6 py-2 rounded-md border border-outline-variant/20 text-primary font-medium hover:bg-primary/5 transition-all text-sm"
        >
          Export
        </button>

        <button
          onClick={onGenerateReport}
          className="px-6 py-2 rounded-md bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-base">auto_awesome</span>
          <span className="hidden md:inline">Generate AI Report</span>
        </button>
      </div>
    </header>
  );
}
