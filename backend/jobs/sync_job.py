"""
jobs/sync_job.py — APScheduler background jobs for data sync and daily digest.
"""

import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from services.sync_service import full_sync, polling_sync
import config

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def send_daily_digest():
    """
    Send ONE summary alert per day at 9am UTC covering all off-target campaigns.
    Respects ALERTS_ENABLED flag.
    """
    if not config.ALERTS_ENABLED:
        logger.info("Daily digest skipped: alerts disabled via config.")
        return

    from routers.campaigns import get_cached_campaigns
    from services.alert_service import send_daily_digest_email, send_daily_digest_slack

    try:
        data = get_cached_campaigns()
        campaigns = data.get("campaigns", [])
        account_summary = data.get("account_summary", {})

        bad_campaigns = [
            c for c in campaigns
            if any(v == "bad" for v in c.get("kpi_status", {}).values())
        ]

        if not bad_campaigns:
            logger.info("Daily digest: all campaigns on target, no digest needed.")
            return

        logger.info(f"Daily digest: {len(bad_campaigns)} campaigns off-target, sending digest.")

        await asyncio.to_thread(send_daily_digest_email, bad_campaigns, account_summary)
        await asyncio.to_thread(send_daily_digest_slack, bad_campaigns, account_summary)

    except Exception as e:
        logger.error(f"Daily digest failed: {e}")


def setup_jobs():
    """Register all scheduled jobs. Call this on app startup."""

    # Full sync every Sunday at 2am UTC
    scheduler.add_job(
        full_sync,
        trigger=CronTrigger(day_of_week="sun", hour=2, minute=0),
        id="weekly_full_sync",
        replace_existing=True,
    )

    # Polling fallback every 30 minutes
    scheduler.add_job(
        polling_sync,
        trigger=IntervalTrigger(minutes=30),
        id="polling_sync",
        replace_existing=True,
    )

    # Daily digest at 9am UTC
    scheduler.add_job(
        send_daily_digest,
        trigger=CronTrigger(hour=9, minute=0),
        id="daily_digest",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("APScheduler started with sync jobs.")
