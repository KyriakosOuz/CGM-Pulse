/**
 * BudgetPacingCard — Shows budget pacing progress bars for top 5 campaigns.
 * Sorted by urgency: OVERPACING > UNDERPACING > ON TRACK > NO BUDGET.
 *
 * Props:
 *   campaigns: array of campaign objects with pacing data
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDateRangeHistory } from "../../api/client";

// Module-level cache for budget pacing data — survives tab navigation
const _pacingCache = {};
let _pacingCacheVersion = null;

function buildPeriods(dateFrom, dateTo) {
  const end = dateTo || "2026-03-03";
  const start = dateFrom || "2026-01-01";
  const endDate = new Date(end + "T00:00:00");
  const startDate = new Date(start + "T00:00:00");

  const periods = [];
  const cursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor >= startDate) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const monthName = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    periods.push({
      label: monthName,
      from: monthStart < start ? start : monthStart,
      to: monthEnd > end ? end : monthEnd,
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  periods.push({ label: "All Time", from: start, to: end });
  return periods;
}

// Pro-rated expected spend across [from, to], summed per calendar month touched.
// Matches backend math (expected = budget * elapsed/total_days) and extends it
// to multi-month ranges like "All Time".
function computeExpectedSpend(periodFrom, periodTo, budget) {
  if (!budget || budget <= 0) return 0;
  const from = new Date(periodFrom + "T00:00:00");
  const to = new Date(periodTo + "T00:00:00");
  if (to < from) return 0;
  let expected = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= to) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const totalDays = monthEnd.getDate();
    const effStart = monthStart < from ? from : monthStart;
    const effEnd = monthEnd > to ? to : monthEnd;
    const daysInPeriod = Math.round((effEnd - effStart) / 86400000) + 1;
    expected += budget * (daysInPeriod / totalDays);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return expected;
}

function BudgetTooltip() {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  return (
    <span className="relative inline-block" ref={ref}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow((s) => !s)}
        className="text-outline hover:text-on-surface-variant transition-colors text-[11px] leading-none"
        aria-label="Budget estimation info"
      >
        <span className="material-symbols-outlined text-[14px]">info</span>
      </button>
      {show && (
        <div className="absolute bottom-full right-0 mb-2 w-56 p-3 rounded-lg bg-surface-container-highest border border-outline-variant/20 shadow-lg z-30 text-[10px] text-on-surface-variant leading-relaxed">
          Budget is estimated as 110% of each campaign's highest historical monthly spend. No actual budget data is available in the Sheet.
        </div>
      )}
    </span>
  );
}

export default function BudgetPacingCard({ campaigns, datePeriod, lastUpdated }) {
  const navigate = useNavigate();
  const periods = buildPeriods(datePeriod?.date_from, datePeriod?.date_to);
  const [period, setPeriod] = useState(periods[0]);
  const [open, setOpen] = useState(false);

  // Invalidate module cache when data source changes
  if (lastUpdated && _pacingCacheVersion && _pacingCacheVersion !== lastUpdated) {
    Object.keys(_pacingCache).forEach((k) => delete _pacingCache[k]);
    _pacingCacheVersion = lastUpdated;
  } else if (lastUpdated && !_pacingCacheVersion) {
    _pacingCacheVersion = lastUpdated;
  }

  const [monthlyCache, setMonthlyCache] = useState(() => ({ ..._pacingCache }));
  const isCacheLoading = Object.keys(monthlyCache).length < periods.length;

  useEffect(() => {
    if (periods.length && period.label !== periods[0].label) {
      setPeriod(periods[0]);
    }
  }, [datePeriod?.date_from, datePeriod?.date_to]);

  useEffect(() => {
    // If everything is already cached, just use it
    const allCached = periods.every((p) => _pacingCache[p.label]);
    if (allCached) {
      setMonthlyCache({ ..._pacingCache });
      return;
    }

    let cancelled = false;
    async function prefetchAll() {
      for (const p of periods) {
        if (_pacingCache[p.label]) {
          setMonthlyCache((prev) => ({ ...prev, [p.label]: _pacingCache[p.label] }));
          continue;
        }
        try {
          const data = await fetchDateRangeHistory(p.from, p.to);
          if (cancelled) return;
          _pacingCache[p.label] = data;
          setMonthlyCache((prev) => ({ ...prev, [p.label]: data }));
        } catch (e) {
          console.error(`Failed to fetch ${p.label}:`, e);
        }
      }
    }
    prefetchAll();
    return () => { cancelled = true; };
  }, [datePeriod?.date_from, datePeriod?.date_to, lastUpdated]);

  const monthlySpend = monthlyCache[period.label] || null;
  const loadingMonthly = !monthlySpend && isCacheLoading;

  function getCampaignSpend(campaign) {
    if (!monthlySpend?.campaigns) return campaign.pacing?.spent || 0;
    const campaignData = monthlySpend.campaigns?.[campaign.name];
    if (!campaignData?.spend) return 0;
    const total = campaignData.spend.reduce((a, b) => a + b, 0);
    return total;
  }

  function getPacingPercent(campaign) {
    const spent = getCampaignSpend(campaign);
    const budget = campaign.pacing?.budget_estimate || 0;
    const expected = computeExpectedSpend(period.from, period.to, budget);
    if (expected <= 0) return 0;
    return Math.round((spent / expected) * 100);
  }

  function getPacingStatus(campaign) {
    const budget = campaign.pacing?.budget_estimate || 0;
    if (budget <= 0) return "NO BUDGET";
    const spent = getCampaignSpend(campaign);
    const expected = computeExpectedSpend(period.from, period.to, budget);
    if (expected <= 0) return "NO BUDGET";
    const pct = (spent / expected) * 100;
    if (pct > 110) return "OVERPACING";
    if (pct < 80) return "UNDERPACING";
    return "ON TRACK";
  }

  function getPacingColor(status) {
    if (status === "ON TRACK") return "bg-tertiary shadow-[0_0_10px_rgba(236,193,92,0.3)]";
    if (status === "OVERPACING") return "bg-error shadow-[0_0_10px_rgba(255,180,171,0.3)]";
    return "bg-primary shadow-[0_0_10px_rgba(208,188,255,0.3)]";
  }

  function getStatusBadgeClasses(status) {
    if (status === "ON TRACK") return "bg-tertiary/10 text-tertiary";
    if (status === "OVERPACING") return "bg-error/10 text-error";
    if (status === "UNDERPACING") return "bg-secondary/10 text-secondary";
    return "";
  }

  // FIX 1: Only show campaigns with spend > 0 in the selected period
  const campaignsWithSpend = monthlySpend
    ? campaigns.filter((c) => getCampaignSpend(c) > 0)
    : campaigns;
  const activeCount = campaignsWithSpend.length;

  const sorted = [...campaignsWithSpend].sort((a, b) => {
    const statusA = monthlySpend ? getPacingStatus(a) : (a.pacing?.status ?? "NO BUDGET");
    const statusB = monthlySpend ? getPacingStatus(b) : (b.pacing?.status ?? "NO BUDGET");
    const order = { OVERPACING: 0, UNDERPACING: 1, "ON TRACK": 2, "NO BUDGET": 3 };
    const ao = order[statusA] ?? 4;
    const bo = order[statusB] ?? 4;
    if (ao !== bo) return ao - bo;
    return getCampaignSpend(b) - getCampaignSpend(a);
  });
  const displayed = sorted.slice(0, 5);

  // Footer totals use account-level spend from analytics (all campaigns)
  const totalSpent = monthlySpend
    ? (monthlySpend.account?.spend || []).reduce((a, b) => a + b, 0)
    : campaigns.reduce((sum, c) => sum + (c.pacing?.spent || 0), 0);
  const totalBudget = campaigns.reduce((sum, c) => sum + (c.pacing?.budget_estimate || 0), 0);
  const remaining = Math.max(0, totalBudget - totalSpent);

  // FIX 2: Determine if selected period is in the past
  const SHEET_END_DATE = datePeriod?.date_to || "2026-03-03";
  const periodEndDate = new Date(period.to + "T00:00:00");
  const sheetEndDate = new Date(SHEET_END_DATE + "T00:00:00");
  const isPastPeriod = periodEndDate < sheetEndDate;
  const isAllTime = period.label === "All Time";

  function formatMoney(val) {
    return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  return (
    <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/5">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h4 className="font-headline text-lg font-bold">Budget Pacing</h4>
          <p className="text-[10px] text-outline mt-0.5">
            {period.label} spend vs estimated budget
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
          >
            {period.label}
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>
          {open && (
            <div className="absolute right-0 top-6 z-20 bg-surface-container-highest rounded-xl border border-outline-variant/20 py-1 min-w-[160px] shadow-lg">
              {periods.map(p => (
                <button
                  key={p.label}
                  onClick={() => { setPeriod(p); setOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-xs hover:bg-primary/10 transition-colors
                    ${p.label === period.label ? "text-primary" : "text-on-surface-variant"}`}
                >
                  {p.label}
                  {monthlyCache[p.label] ? "" : " ..."}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-outline mb-4">
        Showing {Math.min(5, activeCount)} of {activeCount} campaigns with spend in {period.label}
        {activeCount < campaigns.length && (
          <span className="ml-1 text-outline/50">
            ({campaigns.length - activeCount} had no spend)
          </span>
        )}
      </p>

      <div className="space-y-5">
        {displayed.map((campaign) => {
          const percent = getPacingPercent(campaign);
          const barPercent = Math.min(percent, 100);
          const status = monthlySpend ? getPacingStatus(campaign) : (campaign.pacing?.status || "N/A");
          const spent = getCampaignSpend(campaign);
          const budget = campaign.pacing?.budget_estimate || 0;
          const expected = computeExpectedSpend(period.from, period.to, budget);

          return (
            <div key={campaign.name} className="space-y-2">
              <div className="flex justify-between items-end mb-1">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-on-surface truncate block max-w-[200px]">{campaign.name}</span>
                  <p className="text-[10px] text-outline mt-0.5">
                    {formatMoney(spent)} of {formatMoney(expected)} expected
                  </p>
                </div>
                {/* FIX 4: Show pacing % next to status */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-on-surface-variant">{percent}%</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest ${getStatusBadgeClasses(status)}`}>
                    {status}
                  </span>
                </div>
              </div>
              {loadingMonthly ? (
                <div className="h-2 w-full bg-surface-container-high rounded-full animate-pulse" />
              ) : (
                <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getPacingColor(status)}`}
                    style={{ width: `${barPercent}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={() => navigate("/campaigns")}
          className="text-primary text-xs font-medium hover:underline"
        >
          View all {campaigns.length} campaigns →
        </button>
      </div>

      {/* Context-aware footer */}
      <div className="mt-4 pt-5 border-t border-outline-variant/10">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase text-outline tracking-wider">
              {isAllTime ? "Total Spent" : "Actual Spend"}
            </p>
            <p className="text-lg font-headline font-bold">
              {formatMoney(totalSpent)}
            </p>
            <p className="text-[10px] text-outline mt-0.5">{period.label}</p>
          </div>
          <div className="text-right">
            {isPastPeriod || isAllTime ? (
              <>
                <div className="flex items-center justify-end gap-1">
                  <p className="text-[10px] uppercase text-outline tracking-wider">Monthly Budget Est.</p>
                  <BudgetTooltip />
                </div>
                <p className="text-lg font-headline font-bold text-on-surface-variant">
                  {formatMoney(totalBudget)}
                </p>
                <p className="text-[10px] text-outline mt-0.5">based on historical max spend</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-end gap-1">
                  <p className="text-[10px] uppercase text-outline tracking-wider">Remaining</p>
                  <BudgetTooltip />
                </div>
                <p className="text-lg font-headline font-bold text-tertiary">
                  {formatMoney(remaining)}
                </p>
                <p className="text-[10px] text-outline mt-0.5">of {formatMoney(totalBudget)} est.</p>
              </>
            )}
          </div>
        </div>
        {/* Pacing efficiency line */}
        {totalBudget > 0 && !isAllTime && (
          <p className="text-[10px] text-outline mt-3">
            {period.label} used{" "}
            <span className="font-semibold text-on-surface-variant">
              {((totalSpent / totalBudget) * 100).toFixed(1)}%
            </span>
            {" "}of estimated capacity
          </p>
        )}
      </div>
    </div>
  );
}
