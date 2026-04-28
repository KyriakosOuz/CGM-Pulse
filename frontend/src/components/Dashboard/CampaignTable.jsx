/**
 * CampaignTable — Desktop table listing all campaigns with KPI data.
 * Includes search filtering, column sorting, and Total Spent tooltip.
 *
 * Props:
 *   campaigns: array of campaign objects from API
 *   loading: boolean
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "../Shared/StatusBadge";
import KPIBadge from "../Shared/KPIBadge";

const DASH_PAGE_SIZE = 10;

function formatMoney(n) {
  const num = Number(n);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: num >= 1000 ? 0 : 2,
    maximumFractionDigits: num >= 1000 ? 0 : 2,
  }).format(num);
}
function formatPercent(n) {
  return `${Number(n).toFixed(2)}%`;
}
function formatLargeNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function formatDateShort(str) {
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const SORTABLE_COLUMNS = [
  { key: "name", label: "Name" },
  { key: null, label: "Status" },
  { key: null, label: "Period" },
  { key: "cpc", label: "CPC" },
  { key: "ctr", label: "CTR" },
  { key: "cpl", label: "CPL" },
  { key: "conv_rate", label: "Conv. Rate" },
  { key: "total_spent", label: "Spend", isRight: true, hasTooltip: true },
  { key: "leads", label: "Leads" },
];

function SortIcon({ sortKey, columnKey, sortDir }) {
  if (sortKey !== columnKey) {
    return <span className="material-symbols-outlined text-[12px] opacity-40 group-hover:opacity-100 transition-opacity">unfold_more</span>;
  }
  return <span className="material-symbols-outlined text-[12px] opacity-100">{sortDir === "asc" ? "arrow_upward" : "arrow_downward"}</span>;
}

export default function CampaignTable({ campaigns = [], loading = false }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("total_spent");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  function toggleSort(key) {
    if (!key) return;
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const totalPages = Math.ceil(sorted.length / DASH_PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * DASH_PAGE_SIZE, page * DASH_PAGE_SIZE);

  function handleRowClick(campaignName) {
    navigate(`/campaigns?expand=${encodeURIComponent(campaignName)}`);
  }

  return (
    <section className="bg-surface-container rounded-xl border border-outline-variant/5 overflow-visible">
      <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h4 className="font-headline text-lg font-bold">All Campaigns</h4>
        <div className="relative flex-1 md:w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-md pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary/50 text-on-surface placeholder:text-outline"
            placeholder="Search campaigns..."
            type="text"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-separate border-spacing-0">
          <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-widest font-bold">
            <tr>
              {SORTABLE_COLUMNS.map(({ key, label, isRight, hasTooltip }) => (
                <th
                  key={label}
                  onClick={() => toggleSort(key)}
                  className={`px-6 py-4 ${key ? "cursor-pointer hover:text-on-surface select-none transition-colors group" : ""} ${isRight ? "text-right" : ""} relative`}
                >
                  <span className="flex items-center gap-1">
                    {label}
                    {hasTooltip && (
                      <span className="material-symbols-outlined text-[12px] text-outline ml-0.5 align-middle cursor-help">info</span>
                    )}
                    {key && <SortIcon sortKey={sortKey} columnKey={key} sortDir={sortDir} />}
                  </span>
                  {hasTooltip && (
                    <div className="absolute right-0 top-8 z-20 hidden group-hover:block bg-surface-container-highest text-on-surface-variant text-[11px] rounded-lg px-3 py-2 w-48 border border-outline-variant/20 normal-case tracking-normal font-normal">
                      Sum of all daily spend across the full date range in the Sheet
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-on-surface-variant text-sm">
                  Loading campaign data...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-on-surface-variant text-sm">
                  No campaigns match "{search}"
                </td>
              </tr>
            ) : paginated.map((c) => (
              <tr key={c.name} className="campaign-row cursor-pointer" onClick={() => handleRowClick(c.name)}>
                <td className="px-6 py-5 font-medium">{c.name}</td>
                <td className="px-6 py-5"><StatusBadge status={c.status} /></td>
                <td className="px-6 py-5 text-[11px] text-on-surface-variant whitespace-nowrap">
                  {c.date_from && c.date_to ? (
                    <>{formatDateShort(c.date_from)}<span className="mx-1 text-outline">–</span>{formatDateShort(c.date_to)}</>
                  ) : "—"}
                </td>
                <td className="px-6 py-5">
                  <KPIBadge value={formatMoney(c.cpc)} status={c.kpi_status?.cpc} />
                </td>
                <td className="px-6 py-5">
                  <KPIBadge value={formatPercent(c.ctr)} status={c.kpi_status?.ctr} />
                </td>
                <td className="px-6 py-5">
                  <KPIBadge value={formatMoney(c.cpl)} status={c.kpi_status?.cpl} />
                </td>
                <td className="px-6 py-5">
                  <KPIBadge value={formatPercent(c.conv_rate)} status={c.kpi_status?.conv_rate} />
                </td>
                <td className="px-6 py-5 text-right font-headline font-bold">
                  {formatMoney(c.total_spent)}
                </td>
                <td className="px-6 py-5 text-xs text-on-surface">{c.leads ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/5">
          <span className="text-xs text-on-surface-variant">
            Showing {(page - 1) * DASH_PAGE_SIZE + 1}–{Math.min(page * DASH_PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
            >
              Prev
            </button>
            <span className="text-xs text-on-surface-variant">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
