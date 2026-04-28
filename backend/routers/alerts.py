"""
routers/alerts.py — Alert configuration and test endpoints.
"""

import logging
from fastapi import APIRouter
from pydantic import BaseModel
from services.alert_service import send_email_alert, send_slack_alert
import config

router = APIRouter(prefix="/api/alerts", tags=["alerts"])
logger = logging.getLogger(__name__)


class AlertConfig(BaseModel):
    email: str | None = None
    slack_webhook: str | None = None
    enabled: bool = True


@router.post("/config")
async def save_alert_config(cfg: AlertConfig):
    """Save alert configuration — updates runtime config for email and Slack."""
    if cfg.email is not None:
        config.ALERT_TO_EMAIL = cfg.email
        logger.info(f"Alert email updated to: {cfg.email}")
    if cfg.slack_webhook is not None:
        config.SLACK_WEBHOOK_URL = cfg.slack_webhook
        logger.info("Slack webhook URL updated.")
    config.ALERTS_ENABLED = cfg.enabled
    logger.info(f"Alerts enabled: {cfg.enabled}")
    return {"status": "ok", "message": "Alert config saved."}


@router.get("/config")
async def get_alert_config():
    """Return the current alert configuration."""
    return {
        "email": config.ALERT_TO_EMAIL or "",
        "slack_webhook": config.SLACK_WEBHOOK_URL or "",
        "enabled": config.ALERTS_ENABLED,
    }


@router.post("/test")
async def test_alert():
    """Send a test alert using the worst real campaign from the Sheet."""
    from routers.campaigns import get_cached_campaigns

    try:
        data = get_cached_campaigns()
        campaigns = data.get("campaigns", [])

        # Find worst CPC campaign for a realistic test
        worst = max(campaigns, key=lambda c: c.get("cpc", 0)) if campaigns else None

        if worst:
            name = worst["name"]
            cpc = worst.get("cpc", 6.50)
            all_kpis = {
                "cpc": worst.get("cpc", 0),
                "ctr": worst.get("ctr", 0),
                "cpl": worst.get("cpl", 0),
                "conv_rate": worst.get("conv_rate", 0),
            }
        else:
            name = "TEST CAMPAIGN"
            cpc = 6.50
            all_kpis = None

        app_url = config.FRONTEND_URL

        email_ok = send_email_alert(name, "CPC", cpc, 5.00, "below", all_kpis, app_url)
        slack_ok = send_slack_alert(name, "CPC", cpc, 5.00, "below", all_kpis, app_url)

        return {
            "email_sent": email_ok,
            "slack_sent": slack_ok,
            "campaign_used": name,
        }
    except Exception as e:
        logger.error(f"Test alert failed: {e}")
        return {"email_sent": False, "slack_sent": False, "error": str(e)}
