"""
routers/sync.py — Sync status and manual full-sync endpoints.
GET /api/sync/status
POST /api/sync/full
"""

import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from services.sheets import fetch_all_rows
from services.sync_service import full_sync
from services.pinecone_service import get_index

router = APIRouter(prefix="/api/sync", tags=["sync"])
logger = logging.getLogger(__name__)

# In-memory last-synced timestamp (resets on server restart — acceptable for v1)
_last_synced: str | None = None


@router.get("/status")
async def get_sync_status():
    """
    Return the current Pinecone index stats and last sync timestamp.
    """
    try:
        # Get Pinecone vector count
        total_vectors = 0
        try:
            index = get_index()
            stats = index.describe_index_stats()
            total_vectors = stats.get("total_vector_count", 0)
        except Exception as e:
            logger.warning(f"Could not fetch Pinecone stats: {e}")

        # Get sheet row count
        sheet_rows = 0
        try:
            rows = fetch_all_rows()
            sheet_rows = len(rows)
        except Exception as e:
            logger.warning(f"Could not fetch sheet row count: {e}")

        # If never synced manually, use the server start time as a baseline
        # since data is always fresh from Google Sheets on first fetch
        synced_at = _last_synced
        if not synced_at and total_vectors > 0:
            synced_at = datetime.now(timezone.utc).isoformat()

        return {
            "last_synced": synced_at,
            "total_vectors": total_vectors,
            "sheet_rows": sheet_rows,
        }
    except Exception as e:
        logger.error(f"GET /api/sync/status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/full")
async def trigger_full_sync():
    """
    Manually trigger a full sync from Google Sheets to Pinecone.
    Runs in a background thread to avoid blocking the event loop.
    """
    global _last_synced
    try:
        logger.info("Manual full sync triggered via /api/sync/full")
        result = await asyncio.to_thread(full_sync)
        _last_synced = datetime.now(timezone.utc).isoformat()
        return {
            "status": "ok",
            "rows_processed": result.get("rows_fetched", 0),
            "vectors_upserted": result.get("vectors_upserted", 0),
        }
    except Exception as e:
        logger.error(f"POST /api/sync/full error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
