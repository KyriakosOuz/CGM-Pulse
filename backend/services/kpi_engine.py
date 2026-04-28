"""
services/kpi_engine.py — KPI calculation engine.
Computes CPC, CTR, CPL, and Conversion Rate per campaign and for the account.
All division-by-zero cases return 0.0.
"""

import logging
from typing import Any
from collections import defaultdict
from datetime import datetime

import config

logger = logging.getLogger(__name__)


def _safe_divide(numerator: float, denominator: float) -> float:
    """Return numerator / denominator, or 0.0 if denominator is zero."""
    if denominator == 0:
        return 0.0
    return round(numerator / denominator, 4)


def _kpi_status(metric: str, value: float) -> str:
    """
    Return 'good' or 'bad' based on KPI target thresholds.

    Args:
        metric: One of 'cpc', 'ctr', 'cpl', 'conv_rate'
        value: The calculated metric value
    """
    if metric == "cpc":
        return "good" if value < config.CPC_TARGET else "bad"
    elif metric == "ctr":
        return "good" if value > config.CTR_TARGET else "bad"
    elif metric == "cpl":
        return "good" if value < config.CPL_TARGET else "bad"
    elif metric == "conv_rate":
        return "good" if value > config.CONV_RATE_TARGET else "bad"
    return "unknown"


def _compute_kpis(impressions: int, clicks: int, spent: float,
                  conversions: int, leads: int) -> dict[str, Any]:
    """Compute all four KPIs and their statuses from raw aggregated values."""
    cpc = _safe_divide(spent, clicks)
    ctr = round(_safe_divide(clicks, impressions) * 100, 4)
    cpl = _safe_divide(spent, leads)
    conv_rate = round(_safe_divide(conversions, clicks) * 100, 4)

    return {
        "impressions": impressions,
        "clicks": clicks,
        "total_spent": round(spent, 2),
        "leads": leads,
        "conversions": conversions,
        "cpc": round(cpc, 2),
        "ctr": round(ctr, 4),
        "cpl": round(cpl, 2),
        "conv_rate": round(conv_rate, 4),
        "kpi_status": {
            "cpc": _kpi_status("cpc", cpc),
            "ctr": _kpi_status("ctr", ctr),
            "cpl": _kpi_status("cpl", cpl),
            "conv_rate": _kpi_status("conv_rate", conv_rate),
        }
    }


def aggregate_by_campaign(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Group rows by campaign name, sum all numeric fields, compute KPIs.

    Args:
        rows: Output of sheets.fetch_all_rows()

    Returns:
        Dict with keys:
          - 'account_summary': aggregated KPIs across all campaigns
          - 'campaigns': list of per-campaign KPI dicts
          - 'last_updated': ISO timestamp of when this was calculated
    """
    totals_by_campaign: dict[str, dict] = defaultdict(lambda: {
        "impressions": 0, "clicks": 0, "spent": 0.0,
        "conversions": 0, "leads": 0
    })
    # Track last-seen "status" per campaign (Active/Paused)
    # The sheet doesn't have a status column, so we infer from recency
    campaign_dates: dict[str, list[str]] = defaultdict(list)

    for row in rows:
        name = row.get(config.SHEET_COL_CAMPAIGN, "Unknown")
        totals_by_campaign[name]["impressions"] += row.get(config.SHEET_COL_IMPRESSIONS, 0)
        totals_by_campaign[name]["clicks"] += row.get(config.SHEET_COL_CLICKS, 0)
        totals_by_campaign[name]["spent"] += row.get(config.SHEET_COL_SPENT, 0.0)
        totals_by_campaign[name]["conversions"] += row.get(config.SHEET_COL_CONVERSIONS, 0)
        totals_by_campaign[name]["leads"] += row.get(config.SHEET_COL_LEADS, 0)
        date_str = row.get(config.SHEET_COL_DATE, "")
        if date_str:
            campaign_dates[name].append(date_str)

    # Find the dataset's own max date (not today) for status inference
    all_campaign_dates = [d for dates in campaign_dates.values() for d in dates]
    dataset_max = max(all_campaign_dates) if all_campaign_dates else None

    campaigns = []
    account_totals = {"impressions": 0, "clicks": 0, "spent": 0.0,
                      "conversions": 0, "leads": 0}

    for name, t in totals_by_campaign.items():
        kpis = _compute_kpis(
            t["impressions"], t["clicks"], t["spent"],
            t["conversions"], t["leads"]
        )

        # Infer status: "Active" if latest date within 3 days of TODAY (not dataset max)
        # This ensures historical datasets correctly show all campaigns as Paused
        status = "Paused"
        if campaign_dates[name]:
            try:
                latest = max(campaign_dates[name])
                latest_date = datetime.strptime(latest, "%Y-%m-%d").date()
                today = datetime.now().date()
                if (today - latest_date).days <= 3:
                    status = "Active"
            except ValueError:
                pass  # malformed date, leave as Paused

        # Add date range for this campaign
        min_date = min(campaign_dates[name]) if campaign_dates[name] else None
        max_date = max(campaign_dates[name]) if campaign_dates[name] else None
        campaign_data = {"name": name, "status": status, "date_from": min_date, "date_to": max_date, **kpis}
        campaigns.append(campaign_data)

        for key in ["impressions", "clicks", "conversions", "leads"]:
            account_totals[key] += t[key]
        account_totals["spent"] += t["spent"]

    account_summary = _compute_kpis(
        account_totals["impressions"],
        account_totals["clicks"],
        account_totals["spent"],
        account_totals["conversions"],
        account_totals["leads"]
    )

    # Add date range to account summary, clamped to the official dataset
    # end so the frontend's period bounds don't drift past the documented
    # window when the Sheet contains stray late-dated rows.
    all_dates = [d for dates in campaign_dates.values() for d in dates]
    if all_dates:
        account_summary["date_from"] = min(all_dates)
        try:
            raw_max = datetime.strptime(max(all_dates), "%Y-%m-%d").date()
            clamped = min(raw_max, config.DATASET_END_DATE)
            account_summary["date_to"] = clamped.strftime("%Y-%m-%d")
        except ValueError:
            account_summary["date_to"] = max(all_dates)

    # Sort campaigns: Active first, then by total spend descending
    campaigns.sort(key=lambda c: (c["status"] != "Active", -c["total_spent"]))

    return {
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "account_summary": account_summary,
        "campaigns": campaigns
    }
