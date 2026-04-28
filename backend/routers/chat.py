"""
routers/chat.py — RAG chat endpoint with smart query routing.

POST /api/chat
Body: {"question": str, "history": list[dict]}

POST /api/chat/debug
Body: {"question": str}
Returns: routing decision and filter metadata (no Claude call).

Routing logic:
- "api"    → aggregate/ranking/recency questions answered from
             /api/campaigns pre-aggregated data (no Pinecone)
- "rag"    → specific campaign/date/region questions answered from
             Pinecone semantic search with metadata filter
- "hybrid" → both sources merged (for questions that need ranking
             context AND narrative detail)
"""

import json
import logging
import re
import time
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.pinecone_service import query_index, _extract_filters
from services.claude_service import stream_chat_answer
from services.sheets import fetch_all_rows
from services.kpi_engine import aggregate_by_campaign

router = APIRouter(prefix="/api", tags=["chat"])
logger = logging.getLogger(__name__)

# ── In-memory campaigns cache ──────────────────────────────────────────────
_campaigns_cache: dict = {}
_cache_ts: float = 0.0
_CACHE_TTL: int = 300  # 5 minutes


def _get_campaigns_data() -> dict:
    """
    Return cached /api/campaigns data, refreshing if stale.
    Used by the API routing path so aggregate questions don't hit Sheets every time.
    """
    global _campaigns_cache, _cache_ts
    now = time.time()
    if not _campaigns_cache or (now - _cache_ts) > _CACHE_TTL:
        try:
            rows = fetch_all_rows()
            _campaigns_cache = aggregate_by_campaign(rows)
            _cache_ts = now
            logger.info("Chat: campaigns cache refreshed.")
        except Exception as e:
            logger.warning(f"Chat: campaigns cache refresh failed: {e}")
    return _campaigns_cache


# ── Intent pattern lists ───────────────────────────────────────────────────
_AGGREGATE_PATTERNS = [
    "total", "sum", "how much", "overall", "combined", "all campaigns",
    "account level", "account-level", "entire account", "portfolio",
    "how many campaigns",
]
_RANKING_PATTERNS = [
    "best", "worst", "top", "bottom", "highest", "lowest",
    "most", "least", "ranking", "rank", "compare all",
    "which campaign has the", "which campaigns have the",
]
_RECENCY_PATTERNS = [
    "latest", "most recent", "last week", "this week", "yesterday",
    "today", "current", "right now", "newest", "recently",
]
_SPECIFIC_CAMPAIGN_PATTERNS = [
    "prod_", "prod ", "q1'26", "q2'25", "q3'25", "q4'25",
    "ams", "emea", "apj", "thailand", " ww ", "consented",
    "not consented", "ffta", "gdqa", "tofu", "late stage",
    "document", "image", "lead gen", "site visits",
]


def detect_intent(question: str) -> str:
    """
    Classify the question into a routing category.

    Returns:
        "api"    — answer from pre-aggregated campaigns data (faster, exact)
        "rag"    — answer from Pinecone semantic search (richer narrative)
        "hybrid" — both sources (used for ranking + detail combos)

    Decision logic (in priority order):
    1. Aggregate totals → api (Pinecone can't sum columns)
    2. Ranking/comparison → api (already sorted, all campaigns present)
    3. Recency/latest → api (RAG doesn't know date order)
    4. Specific campaign/region/audience → rag (metadata filter available)
    5. Default → rag
    """
    q = question.lower()

    if any(p in q for p in _AGGREGATE_PATTERNS):
        return "api"

    if any(p in q for p in _RANKING_PATTERNS):
        # If ranking + specific region/product → hybrid
        if any(p in q for p in _SPECIFIC_CAMPAIGN_PATTERNS):
            return "hybrid"
        return "api"

    if any(p in q for p in _RECENCY_PATTERNS):
        return "api"

    if any(p in q for p in _SPECIFIC_CAMPAIGN_PATTERNS):
        return "rag"

    # Date pattern present → rag with date filter
    if re.search(r'\d{4}-\d{2}-\d{2}', question):
        return "rag"

    return "rag"


def get_api_context(question: str, campaigns_data: dict) -> str:
    """
    Build a structured context string from pre-aggregated campaign data.

    Used for the "api" routing path — aggregate, ranking, and recency queries
    that need all-campaigns data rather than a semantic search subset.
    """
    campaigns = campaigns_data.get("campaigns", [])
    account = campaigns_data.get("account_summary", {})
    last_updated = campaigns_data.get("last_updated", "unknown")

    def fmt_money(v: float) -> str:
        if v >= 1000:
            return f"${v:,.0f}"
        return f"${v:.2f}"

    context = (
        f"ACCOUNT SUMMARY — CGM Pulse (Jan 1 – Mar 3, 2026)\n"
        f"Data as of: {last_updated}\n"
        f"Total Campaigns: {len(campaigns)}\n"
        f"Account CPC: {fmt_money(account.get('cpc', 0))} "
        f"({'good' if account.get('kpi_status', {}).get('cpc') == 'good' else 'bad'}, target <$5.00)\n"
        f"Account CTR: {account.get('ctr', 0):.2f}% "
        f"({'good' if account.get('kpi_status', {}).get('ctr') == 'good' else 'bad'}, target >0.65%)\n"
        f"Account CPL: {fmt_money(account.get('cpl', 0))} "
        f"({'good' if account.get('kpi_status', {}).get('cpl') == 'good' else 'bad'}, target <$120)\n"
        f"Account Conv Rate: {account.get('conv_rate', 0):.2f}% "
        f"({'good' if account.get('kpi_status', {}).get('conv_rate') == 'good' else 'bad'}, target >1%)\n"
        f"Total Spent: {fmt_money(account.get('total_spent', 0))}\n"
        f"Total Leads: {int(account.get('leads', 0)):,}\n\n"
        f"ALL CAMPAIGNS (sorted by total spend, highest first):\n"
    )

    for c in campaigns[:30]:
        status_icon = "+" if all(
            v == "good" for v in c.get("kpi_status", {}).values()
        ) else "-"
        pacing = c.get("pacing", {})
        pacing_str = (
            f"Pacing: {pacing.get('status', 'N/A')}"
            if pacing else "Pacing: N/A"
        )
        context += (
            f"\n{status_icon} {c['name'][:80]}\n"
            f"   Status: {c.get('status', 'Unknown')} | {pacing_str}\n"
            f"   CPC: {fmt_money(c.get('cpc', 0))} [{c.get('kpi_status', {}).get('cpc', '?')}] | "
            f"CTR: {c.get('ctr', 0):.2f}% [{c.get('kpi_status', {}).get('ctr', '?')}] | "
            f"CPL: {fmt_money(c.get('cpl', 0))} [{c.get('kpi_status', {}).get('cpl', '?')}] | "
            f"Conv: {c.get('conv_rate', 0):.2f}% [{c.get('kpi_status', {}).get('conv_rate', '?')}]\n"
            f"   Spent: {fmt_money(c.get('total_spent', 0))} | "
            f"Leads: {int(c.get('leads', 0))} | "
            f"Clicks: {int(c.get('clicks', 0)):,}\n"
        )

    if len(campaigns) > 30:
        context += f"\n[{len(campaigns) - 30} additional campaigns not shown — use the Campaigns page for full list]\n"

    return context


class ChatRequest(BaseModel):
    question: str
    history: list[dict] = []


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Route the question to the best data source and stream Claude's answer.

    Routing:
    - "api"    → get_api_context() → stream_chat_answer()
    - "rag"    → query_index() with metadata filter → stream_chat_answer()
    - "hybrid" → both sources concatenated → stream_chat_answer()
    """
    try:
        intent = detect_intent(request.question)
        logger.info(f"Chat intent: '{intent}' for question: '{request.question[:80]}'")

        # Build context based on intent
        if intent == "api":
            campaigns_data = _get_campaigns_data()
            context_text = get_api_context(request.question, campaigns_data)
            context_type = "api"

        elif intent == "rag":
            chunks = query_index(request.question)
            context_text = "\n\n---\n\n".join(chunks) if chunks else ""
            context_type = "rag"

        else:  # "hybrid" — run API and RAG in parallel
            import asyncio

            def _build_api_ctx():
                campaigns_data = _get_campaigns_data()
                return get_api_context(request.question, campaigns_data)

            def _build_rag_ctx():
                rag_chunks = query_index(request.question, top_k=8)
                return "\n\n---\n\n".join(rag_chunks) if rag_chunks else ""

            loop = asyncio.get_event_loop()
            api_ctx, rag_ctx = await asyncio.gather(
                loop.run_in_executor(None, _build_api_ctx),
                loop.run_in_executor(None, _build_rag_ctx),
            )
            context_text = f"{api_ctx}\n\nDETAILED CAMPAIGN DATA (from vector search):\n{rag_ctx}"
            context_type = "hybrid"

        async def event_generator():
            try:
                async for chunk in stream_chat_answer(
                    request.question,
                    context_text,
                    request.history,
                    context_type=context_type,
                ):
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                logger.error(f"Chat stream error: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    except Exception as e:
        logger.error(f"POST /api/chat error: {e}")
        return StreamingResponse(
            iter([f"data: {json.dumps({'error': str(e)})}\n\n"]),
            media_type="text/event-stream",
        )


@router.post("/chat/debug")
async def chat_debug(request: ChatRequest):
    """
    Debug endpoint — returns routing decision and extracted filters
    WITHOUT making a Claude API call. Useful for testing intent detection.
    """
    intent = detect_intent(request.question)
    filters = _extract_filters(request.question) if intent in ("rag", "hybrid") else None

    context_preview = ""
    try:
        if intent == "api":
            campaigns_data = _get_campaigns_data()
            context_preview = get_api_context(request.question, campaigns_data)[:500]
        elif intent == "rag":
            chunks = query_index(request.question)
            context_preview = chunks[0][:500] if chunks else "No chunks returned."
        else:
            context_preview = "[hybrid — would merge API + RAG context]"
    except Exception as e:
        context_preview = f"Error building context: {e}"

    return {
        "question": request.question,
        "intent": intent,
        "filters": filters,
        "context_preview": context_preview,
    }
