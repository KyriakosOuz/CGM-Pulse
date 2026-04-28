/**
 * Campaigns.jsx — Full campaign management page (/campaigns).
 * Desktop: paginated table with inline row expansion.
 * Mobile: load-more campaign cards with tap expansion.
 *
 * Props:
 *   campaignsHook: { data, loading, error, refresh } from useCampaigns
 *   onOpenChat: (prefill?: string) => void
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/Shared/PageHeader";
import EmptyState from "../components/Shared/EmptyState";
import SummaryStatsBar from "../components/Campaigns/SummaryStatsBar";
import CampaignDetailRow from "../components/Campaigns/CampaignDetailRow";
import KPIBadge from "../components/Shared/KPIBadge";
import StatusBadge from "../components/Shared/StatusBadge";
import { fetchCampaignHistory } from "../api/client";

function formatDateShort(str) {
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const PAGE_SIZE = 20;
const MOBILE_STEP = 10;

const SORTABLE_COLUMNS = [
  { key: "name", label: "Campaign", isString: true },
  { key: null, label: "Status" },
  { key: "date_from", label: "Period", isString: true },
  { key: "cpc", label: "CPC" },
  { key: "ctr", label: "CTR" },
  { key: "cpl", label: "CPL" },
  { key: "conv_rate", label: "Conv Rate" },
  { key: "total_spent", label: "Spend" },
  { key: "leads", label: "Leads" },
];

export default function Campaigns({ campaignsHook, onOpenChat }) {
  const { data, loading, error } = campaignsHook;
  const allCampaigns = data?.campaigns || [];
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("total_spent");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [mobileVisible, setMobileVisible] = useState(MOBILE_STEP);
  const [expandedRow, setExpandedRow] = useState(null);
  const [rowHistory, setRowHistory] = useState({});
  const [rowHistoryLoading, setRowHistoryLoading] = useState({});
  const expandHandled = useRef(false);
  const pendingExpand = useRef(null);
  const scrollTarget = useRef(null);

  // Store expand param before filtered list is computed
  useEffect(() => {
    if (expandHandled.current || loading || !allCampaigns.length) return;
    const expandName = searchParams.get("expand");
    if (!expandName) return;
    expandHandled.current = true;
    pendingExpand.current = expandName;
    setSearchParams({}, { replace: true });
  }, [loading, allCampaigns, searchParams]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    let list = allCampaigns.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });

    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = a[sortKey] ?? 0;
        const bv = b[sortKey] ?? 0;
        if (typeof av === "string") {
          return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }

    return list;
  }, [allCampaigns, search, statusFilter, sortKey, sortDir]);

  // Process pending expand after filtered list is ready
  useEffect(() => {
    const expandName = pendingExpand.current;
    if (!expandName || !filtered.length) return;
    pendingExpand.current = null;

    const idx = filtered.findIndex((c) => c.name === expandName);
    if (idx >= 0) {
      const targetPage = Math.floor(idx / PAGE_SIZE) + 1;
      setPage(targetPage);
      setMobileVisible(Math.max(MOBILE_STEP, idx + 1));
      handleExpandRow(expandName);
      scrollTarget.current = expandName;
    }
  }, [filtered]);

  // Scroll to expanded row after DOM updates
  useEffect(() => {
    if (!scrollTarget.current || !expandedRow) return;
    const name = scrollTarget.current;
    scrollTarget.current = null;
    // Wait for React to render the page change + expanded row
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`campaign-row-${name}`);
        if (!el) return;
        // Offset for sticky headers: mobile ~56px, desktop ~80px
        const headerOffset = 70;
        const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top, behavior: "smooth" });
      });
    });
  }, [expandedRow, page, mobileVisible]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const mobileList = filtered.slice(0, mobileVisible);

  async function handleExpandRow(name) {
    if (expandedRow === name) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(name);
    if (!rowHistory[name]) {
      setRowHistoryLoading((prev) => ({ ...prev, [name]: true }));
      try {
        const result = await fetchCampaignHistory(name);
        setRowHistory((prev) => ({ ...prev, [name]: result }));
      } catch {
        setRowHistory((prev) => ({ ...prev, [name]: null }));
      } finally {
        setRowHistoryLoading((prev) => ({ ...prev, [name]: false }));
      }
    }
  }

  function handleAskClaude(name) {
    onOpenChat(`Give me a full analysis of campaign: ${name}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        subtitle={`${allCampaigns.length} campaigns · ${allCampaigns.filter((c) => c.status === "Active").length} active`}
      />

      <SummaryStatsBar campaigns={allCampaigns} />

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base">
            search
          </span>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search campaigns..."
            className="w-full bg-surface-container border-none rounded-xl py-2.5 pl-9 pr-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-outline-variant"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-surface-container border border-outline-variant/20 rounded-xl py-2.5 px-3 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
        </select>

        <span className="text-xs text-on-surface-variant ml-auto">
          Showing {filtered.length} of {allCampaigns.length}
        </span>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-4 text-sm text-error">
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden lg:block">
        {loading ? (
          <p className="text-on-surface-variant text-sm py-8 text-center">Loading campaigns...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon="search_off" title="No campaigns match" message="Try adjusting your search or filters." />
        ) : (
          <>
            <div className="bg-surface-container rounded-xl overflow-hidden border border-outline-variant/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-high">
                    {SORTABLE_COLUMNS.map((col) => (
                      <th
                        key={col.label}
                        onClick={col.key ? () => toggleSort(col.key) : undefined}
                        className={`text-left text-[10px] font-bold uppercase tracking-widest px-4 py-3 select-none transition-colors
                          ${col.key ? "cursor-pointer hover:text-on-surface group text-outline" : "text-outline"}`}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.key && (
                            <span className="material-symbols-outlined text-[12px] opacity-40 group-hover:opacity-100 transition-opacity">
                              {sortKey === col.key ? (sortDir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                            </span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c) => (
                    <tr key={c.name} className="contents">
                      <tr
                        id={`campaign-row-${c.name}`}
                        onClick={() => handleExpandRow(c.name)}
                        className="campaign-row cursor-pointer border-b border-outline-variant/5 last:border-0"
                      >
                        <td className="px-4 py-3 max-w-xs">
                          <p className="font-medium text-on-surface truncate text-xs">{c.name}</p>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-[11px] text-on-surface-variant whitespace-nowrap">
                          {c.date_from && c.date_to ? (
                            <>{formatDateShort(c.date_from)}<span className="mx-1 text-outline">–</span>{formatDateShort(c.date_to)}</>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <KPIBadge value={`$${Number(c.cpc || 0).toFixed(2)}`} status={c.kpi_status?.cpc} />
                        </td>
                        <td className="px-4 py-3">
                          <KPIBadge value={`${Number(c.ctr || 0).toFixed(2)}%`} status={c.kpi_status?.ctr} />
                        </td>
                        <td className="px-4 py-3">
                          <KPIBadge value={`$${Number(c.cpl || 0).toFixed(2)}`} status={c.kpi_status?.cpl} />
                        </td>
                        <td className="px-4 py-3">
                          <KPIBadge value={`${Number(c.conv_rate || 0).toFixed(2)}%`} status={c.kpi_status?.conv_rate} />
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface font-semibold">
                          ${Number(c.total_spent || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface">{c.leads ?? 0}</td>
                      </tr>
                      {expandedRow === c.name && (
                        <tr key={`${c.name}-detail`}>
                          <td colSpan={9} className="px-4 pb-4">
                            <CampaignDetailRow
                              campaign={c}
                              history={rowHistory[c.name]}
                              historyLoading={rowHistoryLoading[c.name]}
                              onAskClaude={handleAskClaude}
                            />
                          </td>
                        </tr>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
                >
                  Prev
                </button>
                <span className="text-xs text-on-surface-variant">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <p className="text-on-surface-variant text-sm">Loading...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon="search_off" title="No campaigns match" />
        ) : (
          <>
            {mobileList.map((c) => (
              <div key={c.name} id={`campaign-row-${c.name}`} className="bg-surface-container rounded-xl overflow-hidden">
                <button onClick={() => handleExpandRow(c.name)} className="w-full text-left p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-xs font-semibold text-on-surface leading-snug line-clamp-2">{c.name}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {[
                      { label: "CPC", value: `$${Number(c.cpc || 0).toFixed(2)}`, key: "cpc" },
                      { label: "CTR", value: `${Number(c.ctr || 0).toFixed(2)}%`, key: "ctr" },
                      { label: "CPL", value: `$${Number(c.cpl || 0).toFixed(2)}`, key: "cpl" },
                      { label: "Conv", value: `${Number(c.conv_rate || 0).toFixed(2)}%`, key: "conv_rate" },
                    ].map(({ label, value, key }) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-[10px] text-outline uppercase">{label}</span>
                        <KPIBadge value={value} status={c.kpi_status?.[key]} />
                      </div>
                    ))}
                  </div>
                </button>

                {expandedRow === c.name && (
                  <div className="px-4 pb-4 border-t border-outline-variant/10">
                    <CampaignDetailRow
                      campaign={c}
                      history={rowHistory[c.name]}
                      historyLoading={rowHistoryLoading[c.name]}
                      onAskClaude={handleAskClaude}
                    />
                  </div>
                )}
              </div>
            ))}

            {mobileVisible < filtered.length && (
              <button
                onClick={() => setMobileVisible((v) => v + MOBILE_STEP)}
                className="w-full py-3 text-sm font-semibold text-primary hover:bg-primary/5 rounded-xl transition-colors"
              >
                Load more ({filtered.length - mobileVisible} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
