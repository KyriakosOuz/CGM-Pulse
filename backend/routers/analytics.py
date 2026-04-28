"""
routers/analytics.py — Analytics date-range history endpoint.
GET /api/analytics/history?from=YYYY-MM-DD&to=YYYY-MM-DD

Returns daily aggregated account-level and per-campaign KPIs for use
by the Analytics page ComparisonChart and TrendKPICards.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from collections import defaultdict
from services.sheets import fetch_all_rows
import config

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)


def _safe_divide(numerator: float, denominator: float) -> float:
    """Return numerator / denominator, or 0.0 if denominator is zero."""
    if denominator == 0:
        return 0.0
    return round(numerator / denominator, 4)


@router.get("/history")
async def get_analytics_history(
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
):
    """
    Fetch all rows from Google Sheets, filter to the requested date range,
    group by date, and compute per-day account-level and per-campaign KPIs.
    """
    try:
        # Validate date params
        try:
            start = datetime.strptime(from_date, "%Y-%m-%d").date()
            end = datetime.strptime(to_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid date format. Use YYYY-MM-DD for both 'from' and 'to'."
            )

        if start > end:
            raise HTTPException(
                status_code=400,
                detail="'from' date must be on or before 'to' date."
            )

        # Fetch all sheet rows
        all_rows = fetch_all_rows()

        # Filter to date range and group by date
        rows_by_date: dict[str, list[dict]] = defaultdict(list)

        for row in all_rows:
            date_str = row.get(config.SHEET_COL_DATE, "")
            if not date_str:
                continue
            try:
                row_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                continue
            if start <= row_date <= end:
                rows_by_date[date_str].append(row)

        # Sort dates ascending
        sorted_dates = sorted(rows_by_date.keys())

        if not sorted_dates:
            return {
                "dates": [],
                "account": {"cpc": [], "ctr": [], "cpl": [], "conv_rate": [], "spend": [], "clicks": []},
                "campaigns": {}
            }

        # Build account-level daily KPIs and per-campaign daily KPIs
        account_daily = {"cpc": [], "ctr": [], "cpl": [], "conv_rate": [], "spend": [], "clicks": []}
        campaign_daily: dict[str, dict[str, list]] = defaultdict(
            lambda: {"cpc": [], "ctr": [], "cpl": [], "conv_rate": [], "spend": []}
        )

        # Period-level totals for summary KPIs
        period_impressions = 0.0
        period_clicks = 0.0
        period_spent = 0.0
        period_conversions = 0.0
        period_leads = 0.0

        # Collect all campaign names seen across the date range
        all_campaign_names: set[str] = set()
        for date_str in sorted_dates:
            for row in rows_by_date[date_str]:
                name = row.get(config.SHEET_COL_CAMPAIGN, "")
                if name:
                    all_campaign_names.add(name)

        for date_str in sorted_dates:
            day_rows = rows_by_date[date_str]

            # Account totals for this day
            total_impressions = 0.0
            total_clicks = 0.0
            total_spent = 0.0
            total_conversions = 0.0
            total_leads = 0.0

            # Per-campaign totals for this day
            campaign_day: dict[str, dict] = defaultdict(lambda: {
                "impressions": 0.0, "clicks": 0.0, "spent": 0.0,
                "conversions": 0.0, "leads": 0.0
            })

            for row in day_rows:
                name = row.get(config.SHEET_COL_CAMPAIGN, "")
                impressions = row.get(config.SHEET_COL_IMPRESSIONS, 0) or 0
                clicks = row.get(config.SHEET_COL_CLICKS, 0) or 0
                spent = row.get(config.SHEET_COL_SPENT, 0.0) or 0.0
                conversions = row.get(config.SHEET_COL_CONVERSIONS, 0) or 0
                leads = row.get(config.SHEET_COL_LEADS, 0) or 0

                total_impressions += impressions
                total_clicks += clicks
                total_spent += spent
                total_conversions += conversions
                total_leads += leads

                period_impressions += impressions
                period_clicks += clicks
                period_spent += spent
                period_conversions += conversions
                period_leads += leads

                if name:
                    campaign_day[name]["impressions"] += impressions
                    campaign_day[name]["clicks"] += clicks
                    campaign_day[name]["spent"] += spent
                    campaign_day[name]["conversions"] += conversions
                    campaign_day[name]["leads"] += leads

            # Account daily KPIs
            account_daily["cpc"].append(round(
                _safe_divide(total_spent, total_clicks), 2
            ))
            account_daily["ctr"].append(round(
                _safe_divide(total_clicks, total_impressions) * 100, 4
            ))
            account_daily["cpl"].append(round(
                _safe_divide(total_spent, total_leads), 2
            ))
            account_daily["conv_rate"].append(round(
                _safe_divide(total_conversions, total_clicks) * 100, 4
            ))
            account_daily["spend"].append(round(total_spent, 2))
            account_daily["clicks"].append(int(total_clicks))

            # Per-campaign daily KPIs
            for campaign_name in all_campaign_names:
                t = campaign_day.get(campaign_name, {
                    "impressions": 0.0, "clicks": 0.0, "spent": 0.0,
                    "conversions": 0.0, "leads": 0.0
                })
                campaign_daily[campaign_name]["cpc"].append(
                    round(_safe_divide(t["spent"], t["clicks"]), 2)
                )
                campaign_daily[campaign_name]["ctr"].append(
                    round(_safe_divide(t["clicks"], t["impressions"]) * 100, 4)
                )
                campaign_daily[campaign_name]["cpl"].append(
                    round(_safe_divide(t["spent"], t["leads"]), 2)
                )
                campaign_daily[campaign_name]["conv_rate"].append(
                    round(_safe_divide(t["conversions"], t["clicks"]) * 100, 4)
                )
                campaign_daily[campaign_name]["spend"].append(
                    round(t["spent"], 2)
                )

        # Compute period-level summary KPIs
        period_cpc = round(_safe_divide(period_spent, period_clicks), 2)
        period_ctr = round(_safe_divide(period_clicks, period_impressions) * 100, 2)
        period_cpl = round(_safe_divide(period_spent, period_leads), 2)
        period_conv_rate = round(_safe_divide(period_conversions, period_clicks) * 100, 2)

        summary = {
            "cpc": period_cpc,
            "ctr": period_ctr,
            "cpl": period_cpl,
            "conv_rate": period_conv_rate,
            "kpi_status": {
                "cpc": "good" if period_cpc < 5 else "bad",
                "ctr": "good" if period_ctr > 0.65 else "bad",
                "cpl": "good" if period_cpl < 120 else "bad",
                "conv_rate": "good" if period_conv_rate > 1.0 else "bad",
            },
        }

        return {
            "dates": sorted_dates,
            "account": account_daily,
            "campaigns": dict(campaign_daily),
            "summary": summary,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GET /api/analytics/history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
