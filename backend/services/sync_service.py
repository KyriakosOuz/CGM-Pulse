"""
services/sync_service.py — Orchestrates data sync from Google Sheets to Pinecone.
Supports full sync (all rows) and incremental sync (single changed row).
"""

import logging
from typing import Any
from services.sheets import fetch_all_rows
from services.pinecone_service import upsert_rows

logger = logging.getLogger(__name__)

# In-memory counter to detect new rows during polling fallback
_last_synced_row_count: int = 0


def full_sync() -> dict[str, Any]:
    """
    Fetch all rows from Google Sheets and upsert all to Pinecone.
    Run on startup and on schedule (weekly).

    Returns:
        Dict with 'rows_fetched' and 'vectors_upserted'.
    """
    global _last_synced_row_count
    try:
        logger.info("Starting full sync...")
        rows = fetch_all_rows()
        count = upsert_rows(rows)
        _last_synced_row_count = len(rows)
        logger.info(f"Full sync complete: {len(rows)} rows, {count} vectors.")
        return {"rows_fetched": len(rows), "vectors_upserted": count}
    except Exception as e:
        logger.error(f"Full sync failed: {e}")
        raise


def incremental_sync(row: dict[str, Any]) -> dict[str, Any]:
    """
    Sync a single changed row (triggered by Google Apps Script webhook).

    Args:
        row: A dict matching the sheet column structure.

    Returns:
        Dict with 'vectors_upserted'.
    """
    try:
        logger.info(f"Incremental sync for row: {row}")
        count = upsert_rows([row])
        return {"vectors_upserted": count}
    except Exception as e:
        logger.error(f"Incremental sync failed: {e}")
        raise


def polling_sync() -> dict[str, Any]:
    """
    Polling fallback: check if row count has increased and sync new rows.
    Called every 30 minutes by APScheduler.
    """
    global _last_synced_row_count
    try:
        rows = fetch_all_rows()
        current_count = len(rows)
        if current_count > _last_synced_row_count:
            new_rows = rows[_last_synced_row_count:]
            count = upsert_rows(new_rows)
            logger.info(f"Polling sync: {len(new_rows)} new rows, {count} vectors.")
            _last_synced_row_count = current_count
            return {"new_rows": len(new_rows), "vectors_upserted": count}
        return {"new_rows": 0, "vectors_upserted": 0}
    except Exception as e:
        logger.error(f"Polling sync failed: {e}")
        return {"error": str(e)}
