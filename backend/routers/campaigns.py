"""
routers/campaigns.py — Campaign KPI endpoints.
GET /api/campaigns — Returns all campaign KPIs with pacing.
GET /api/campaigns/{name}/history — Returns daily history for one campaign.
POST /api/campaigns/refresh — Invalidate in-memory cache.
"""

import logging
import threading
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from services.sheets import fetch_all_rows
from services.kpi_engine import aggregate_by_campaign
from services.budget_pacing import attach_pacing_to_campaigns
from services.alert_service import send_email_alert, send_slack_alert
import config

router = APIRouter(prefix="/api", tags=["campaigns"])
logger = logging.getLogger(__name__)

# ── In-memory cache ───────────────────────────────────────────────────
_cache = {
    "data": None,
    "timestamp": None,
    "lock": threading.Lock(),
}
CACHE_TTL = timedelta(minutes=5)

# ── State-change alert system ─────────────────────────────────────────
# Only alerts when a KPI flips from good → bad, never while it stays bad.
# { "campaign_name": {"cpc": "good"/"bad", ...} }
_previous_kpi_states: dict = {}


def _check_state_change_alerts(campaigns: list[dict]):
    """
    Compare current KPI status to previously seen status.
    Only alert when a KPI transitions good → bad (not while it stays bad).
    Sends at most ONE alert per refresh cycle (the worst newly-bad campaign).
    """
    global _previous_kpi_states

    if not config.ALERTS_ENABLED:
        logger.info("Alerts disabled via config.")
        # Still update state so we don't miss transitions when re-enabled
        for c in campaigns:
            _previous_kpi_states[c["name"]] = dict(c.get("kpi_status", {}))
        return

    newly_bad = []

    for c in campaigns:
        name = c["name"]
        current_status = c.get("kpi_status", {})
        previous_status = _previous_kpi_states.get(name, {})

        # Find KPIs that just turned bad
        flipped = []
        for kpi_key, status in current_status.items():
            prev = previous_status.get(kpi_key)
            if status == "bad" and prev != "bad":
                flipped.append(kpi_key)

        if flipped:
            newly_bad.append({"campaign": c, "flipped_kpis": flipped})

        # Update state tracker
        _previous_kpi_states[name] = dict(current_status)

    if not newly_bad:
        logger.info("Alert check: no state changes detected.")
        return

    # Pick the single worst newly-bad campaign by CPC
    newly_bad.sort(key=lambda x: x["campaign"].get("cpc", 0), reverse=True)
    worst = newly_bad[0]["campaign"]
    flipped_kpis = newly_bad[0]["flipped_kpis"]
    name = worst["name"]

    all_kpis = {
        "cpc": worst.get("cpc", 0),
        "ctr": worst.get("ctr", 0),
        "cpl": worst.get("cpl", 0),
        "conv_rate": worst.get("conv_rate", 0),
    }

    # Use the most severely breached flipped KPI
    kpi_meta = {
        "cpc": ("CPC", 5.00, "below"),
        "ctr": ("CTR", 0.65, "above"),
        "cpl": ("CPL", 120.00, "below"),
        "conv_rate": ("Conv Rate", 1.00, "above"),
    }
    breaches = []
    for key in flipped_kpis:
        if key in kpi_meta:
            label, target, direction = kpi_meta[key]
            val = all_kpis.get(key, 0)
            pct_off = abs((val - target) / target * 100) if target else 0
            breaches.append((pct_off, label, val, target, direction))

    if not breaches:
        return

    breaches.sort(reverse=True)
    _, label, val, target, direction = breaches[0]

    logger.info(f"State change alert: {name} — {label} flipped to bad ({val})")

    threading.Thread(
        target=lambda: (
            send_email_alert(name, label, val, target, direction, all_kpis, config.FRONTEND_URL),
            send_slack_alert(name, label, val, target, direction, all_kpis, config.FRONTEND_URL),
        ),
        daemon=True,
    ).start()


def get_cached_campaigns():
    """Return cached KPI data if fresh (<5 min), otherwise fetch and recompute."""
    with _cache["lock"]:
        now = datetime.utcnow()

        # Cache hit — return immediately, no alert check
        if (
            _cache["data"] is not None
            and _cache["timestamp"] is not None
            and now - _cache["timestamp"] < CACHE_TTL
        ):
            return _cache["data"]

        # Cache miss — fetch fresh data
        rows = fetch_all_rows()
        data = aggregate_by_campaign(rows)
        attach_pacing_to_campaigns(data["campaigns"], rows)
        _cache["data"] = data
        _cache["timestamp"] = now

        # Check for state changes in background (only fires on good→bad transitions)
        threading.Thread(
            target=_check_state_change_alerts,
            args=(data["campaigns"],),
            daemon=True,
        ).start()

        return data


@router.post("/campaigns/refresh")
async def invalidate_cache():
    """Clear the in-memory cache so the next request fetches fresh data."""
    with _cache["lock"]:
        _cache["data"] = None
        _cache["timestamp"] = None
    return {"status": "cache cleared"}


@router.get("/campaigns")
async def get_campaigns():
    """
    Return campaign KPIs with pacing. Uses in-memory cache (5 min TTL).
    """
    try:
        return get_cached_campaigns()
    except Exception as e:
        logger.error(f"GET /api/campaigns error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/campaigns/recent")
async def get_recent_rows(n: int = 10):
    """Return the n most recent rows from the Sheet sorted by date descending."""
    try:
        rows = fetch_all_rows()
        sorted_rows = sorted(
            rows,
            key=lambda r: r.get(config.SHEET_COL_DATE, ""),
            reverse=True
        )
        return {"rows": sorted_rows[:n], "total": len(rows)}
    except Exception as e:
        logger.error(f"GET /api/campaigns/recent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/campaigns/{name}/history")
async def get_campaign_history(name: str):
    """
    Return day-by-day KPI data for a single campaign (for charts).
    """
    try:
        rows = fetch_all_rows()
        campaign_rows = [
            r for r in rows
            if r.get(config.SHEET_COL_CAMPAIGN, "").lower() == name.lower()
        ]

        if not campaign_rows:
            raise HTTPException(status_code=404, detail=f"Campaign '{name}' not found.")

        history = []
        for row in sorted(campaign_rows, key=lambda r: r.get(config.SHEET_COL_DATE, "")):
            impressions = row.get(config.SHEET_COL_IMPRESSIONS, 0)
            clicks = row.get(config.SHEET_COL_CLICKS, 0)
            spent = row.get(config.SHEET_COL_SPENT, 0.0)
            leads = row.get(config.SHEET_COL_LEADS, 0)
            conversions = row.get(config.SHEET_COL_CONVERSIONS, 0)

            cpc = round(spent / clicks, 2) if clicks > 0 else 0
            ctr = round((clicks / impressions) * 100, 4) if impressions > 0 else 0
            cpl = round(spent / leads, 2) if leads > 0 else 0
            conv_rate = round((conversions / clicks) * 100, 4) if clicks > 0 else 0

            history.append({
                "date": row.get(config.SHEET_COL_DATE),
                "impressions": impressions,
                "clicks": clicks,
                "spent": spent,
                "cpc": cpc,
                "ctr": ctr,
                "cpl": cpl,
                "conv_rate": conv_rate
            })

        return {"campaign": name, "history": history}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GET /api/campaigns/{name}/history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
