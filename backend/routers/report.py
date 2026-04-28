"""
routers/report.py — AI report generation endpoint (streaming SSE).
POST /api/report
"""

import json
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from routers.campaigns import get_cached_campaigns
from services.claude_service import stream_report

router = APIRouter(prefix="/api", tags=["report"])
logger = logging.getLogger(__name__)


@router.post("/report")
async def generate_report():
    """
    Fetch live KPI data, pass to Claude, stream the AI report back as SSE.
    Frontend connects with EventSource or fetch() and reads chunks.
    """
    try:
        kpi_data = get_cached_campaigns()

        async def event_generator():
            try:
                async for chunk in stream_report(kpi_data):
                    payload = json.dumps({"chunk": chunk})
                    yield f"data: {payload}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no"
            }
        )
    except Exception as e:
        logger.error(f"POST /api/report error: {e}")
        return StreamingResponse(
            iter([f"data: {json.dumps({'error': str(e)})}\n\n"]),
            media_type="text/event-stream"
        )
