"""
main.py — FastAPI application entry point for CGM Pulse backend.
"""

import threading
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import campaigns, report, chat, alerts, webhook, analytics, sync as sync_router_module, settings as settings_router
from jobs.sync_job import setup_jobs
from services.sync_service import full_sync
import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: bind to port immediately, run Pinecone sync in background.
    Shutdown: stop scheduler cleanly.
    """
    logger.info("CGM Pulse backend starting...")

    # Run full sync in background thread — does NOT block port binding
    def run_startup_sync():
        try:
            result = full_sync()
            logger.info(f"Startup sync complete: {result}")
            sync_router_module._last_synced = (
                datetime.now(timezone.utc).isoformat()
            )
        except Exception as e:
            logger.warning(f"Startup sync failed (non-fatal): {e}")

    threading.Thread(target=run_startup_sync, daemon=True).start()

    # Start background scheduler
    setup_jobs()

    yield  # App runs here

    # Graceful shutdown
    from jobs.sync_job import scheduler
    if scheduler.running:
        scheduler.shutdown()
    logger.info("CGM Pulse backend shut down.")


app = FastAPI(
    title="CGM Pulse API",
    description="LinkedIn Ads KPI monitoring for Compound Growth Marketing",
    version="1.0.0",
    lifespan=lifespan
)

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Include all routers
app.include_router(campaigns.router)
app.include_router(report.router)
app.include_router(chat.router)
app.include_router(alerts.router)
app.include_router(webhook.router)
# ── New routers (expansion) ────────────────────────
app.include_router(analytics.router)
app.include_router(sync_router_module.router)
app.include_router(settings_router.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "CGM Pulse API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=config.PORT, reload=True)
