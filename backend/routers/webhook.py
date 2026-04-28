"""
routers/webhook.py — Google Apps Script webhook receiver.
POST /webhook/sheet-update
"""

import logging
from fastapi import APIRouter
from pydantic import BaseModel
from services.sync_service import incremental_sync
from routers.campaigns import _cache

router = APIRouter(prefix="/webhook", tags=["webhook"])
logger = logging.getLogger(__name__)


class SheetRow(BaseModel):
    date: str
    campaign_name: str
    impressions: int
    clicks: int
    total_spent: float
    conversions: int
    leads: int


@router.post("/sheet-update")
async def sheet_update(row: SheetRow):
    """
    Receive a changed row from Google Apps Script and sync it to Pinecone.
    Returns 200 immediately — sync happens synchronously but is fast.
    """
    row_dict = {
        "Date": row.date,
        "Campaign name": row.campaign_name,
        "Impressions": row.impressions,
        "Clicks": row.clicks,
        "Total spent": row.total_spent,
        "Conversions": row.conversions,
        "Leads": row.leads
    }

    try:
        result = incremental_sync(row_dict)

        # Invalidate campaigns cache so the next dashboard request fetches fresh data
        with _cache["lock"]:
            _cache["data"] = None
            _cache["timestamp"] = None
        logger.info("Cache invalidated after webhook sync.")

        return {"status": "ok", **result}
    except Exception as e:
        logger.error(f"Webhook sync failed: {e}")
        return {"status": "error", "detail": str(e)}
