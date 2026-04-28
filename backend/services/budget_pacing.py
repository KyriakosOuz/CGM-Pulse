"""
services/budget_pacing.py — Budget pacing calculations.

Since the Google Sheet has no budget column, budget is determined in order:
  1. Per-campaign override in config.CAMPAIGN_BUDGETS (set via CAMPAIGN_BUDGETS
     env var, e.g. '{"Enterprise Core Q3": 20000}').
  2. 110% of the campaign's highest single-month historical spend.
  3. config.CAMPAIGN_BUDGETS["default"] (15 000.00) — fallback for new
     campaigns that have no historical spend data yet.
"""

import logging
from datetime import datetime, date
from calendar import monthrange
from collections import defaultdict
from typing import Any

import config

logger = logging.getLogger(__name__)


def _days_in_month(year: int, month: int) -> int:
    return monthrange(year, month)[1]


def _estimate_budget(campaign_name: str, historical_rows: list[dict]) -> float:
    """
    Estimate monthly budget for a campaign.

    Priority:
    1. config.CAMPAIGN_BUDGETS[campaign_name] — set via CAMPAIGN_BUDGETS env var.
    2. 110% of the campaign's highest single-month historical spend.
    3. config.CAMPAIGN_BUDGETS["default"] (15 000.00) — used when there is no
       historical data at all (e.g. brand-new campaign).
    """
    # Priority 1: explicit per-campaign budget (env var or hardcoded in config)
    if campaign_name in config.CAMPAIGN_BUDGETS:
        return config.CAMPAIGN_BUDGETS[campaign_name]

    # Priority 2: derive from historical spend
    monthly_spend: dict[str, float] = defaultdict(float)
    for row in historical_rows:
        if row.get(config.SHEET_COL_CAMPAIGN) != campaign_name:
            continue
        date_str = row.get(config.SHEET_COL_DATE, "")
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d")
            key = f"{d.year}-{d.month:02d}"
            monthly_spend[key] += row.get(config.SHEET_COL_SPENT, 0.0)
        except ValueError:
            continue

    if monthly_spend:
        max_spend = max(monthly_spend.values())
        return round(max_spend * 1.10, 2)

    # Priority 3: fall back to the "default" budget in config
    default_budget = config.CAMPAIGN_BUDGETS.get("default", 15000.00)
    logger.warning(
        "No historical spend found for campaign '%s'. "
        "Using default budget of %.2f.",
        campaign_name, default_budget
    )
    return default_budget


def calculate_pacing(
    campaign_name: str,
    current_month_spent: float,
    all_rows: list[dict],
    reference_date: date | None = None
) -> dict[str, Any]:
    """
    Calculate budget pacing for a campaign for the current month.

    Args:
        campaign_name: The campaign name string.
        current_month_spent: Total spend so far this month for this campaign.
        all_rows: All sheet rows (used to estimate budget historically).
        reference_date: The date to calculate pacing from (defaults to today).

    Returns:
        Dict with keys: budget_estimate, spent, expected_spend,
        pacing_percent, status
    """
    today = reference_date or datetime.utcnow().date()
    days_elapsed = today.day
    total_days = _days_in_month(today.year, today.month)

    budget = _estimate_budget(campaign_name, all_rows)
    # _estimate_budget always returns > 0 now (falls back to config default),
    # but keep this guard for safety against edge cases (e.g. default set to 0).
    if budget <= 0:
        return {
            "budget_estimate": 0,
            "spent": round(current_month_spent, 2),
            "expected_spend": 0,
            "pacing_percent": 0,
            "status": "NO BUDGET"
        }

    expected_spend = round(budget * (days_elapsed / total_days), 2)
    pacing_percent = round((current_month_spent / expected_spend) * 100, 1) \
        if expected_spend > 0 else 0

    if pacing_percent > 110:
        status = "OVERPACING"
    elif pacing_percent < 80:
        status = "UNDERPACING"
    else:
        status = "ON TRACK"

    return {
        "budget_estimate": budget,
        "spent": round(current_month_spent, 2),
        "expected_spend": expected_spend,
        "pacing_percent": pacing_percent,
        "status": status
    }


def attach_pacing_to_campaigns(
    campaigns: list[dict],
    all_rows: list[dict]
) -> list[dict]:
    """
    Attach pacing data to each campaign dict in place.
    Uses the most recent date in the sheet data as the reference date,
    so pacing is accurate even when the sheet data is not up-to-date.
    """
    # Find the last date in the sheet data, then clamp to the official
    # dataset end so a stray late-dated row cannot push pacing past the
    # documented window.
    last_date = None
    for row in all_rows:
        date_str = row.get(config.SHEET_COL_DATE, "")
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d").date()
            if last_date is None or d > last_date:
                last_date = d
        except ValueError:
            continue

    if last_date is None:
        reference = config.DATASET_END_DATE
    else:
        reference = min(last_date, config.DATASET_END_DATE)
    current_month_key = f"{reference.year}-{reference.month:02d}"

    # Sum spend for the reference month per campaign, only up to and
    # including the reference date — same anchor as expected_spend.
    current_spend: dict[str, float] = defaultdict(float)
    for row in all_rows:
        date_str = row.get(config.SHEET_COL_DATE, "")
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d").date()
            if f"{d.year}-{d.month:02d}" == current_month_key and d <= reference:
                name = row.get(config.SHEET_COL_CAMPAIGN, "")
                current_spend[name] += row.get(config.SHEET_COL_SPENT, 0.0)
        except ValueError:
            continue

    for campaign in campaigns:
        name = campaign["name"]
        pacing = calculate_pacing(
            campaign_name=name,
            current_month_spent=current_spend.get(name, 0.0),
            all_rows=all_rows,
            reference_date=reference
        )
        campaign["pacing"] = pacing

    return campaigns
