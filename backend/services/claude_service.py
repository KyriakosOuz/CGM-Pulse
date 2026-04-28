"""
services/claude_service.py — Claude API integration.
Provides streaming AI report generation and RAG-powered chat answers.
"""

import logging
from typing import AsyncGenerator, Any
import anthropic
import config

logger = logging.getLogger(__name__)
_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


CHAT_SYSTEM_PROMPT = """You are a LinkedIn Ads data analyst for Compound Growth Marketing (CGM).
You help ads specialists understand campaign performance and make quick decisions.

YOUR DATA:
- 73 campaigns spanning January 1 – March 3, 2026
- Regions: AMS, EMEA, AMS+EMEA, APJ, WW
- Products: prod_01, prod_02, prod_03, prod_05, prod_09, prod_10, prod_16, prod_17, prod_17a, prod_17aa, prod_17b, prod_18
- ~2,760 daily data points (one per campaign per day)

KPI TARGETS (hard rules — these never change):
- CPC (Cost Per Click): GOOD if < $5.00, BAD if >= $5.00
- CTR (Click-Through Rate): GOOD if > 0.65%, BAD if <= 0.65%
- CPL (Cost Per Lead): GOOD if < $120.00, BAD if >= $120.00
- Conv Rate: GOOD if > 1.00%, BAD if <= 1.00%

NUMBER FORMATTING RULES — follow these exactly:
- Dollar amounts < $1,000: show cents only if non-zero (e.g. $29.89, not $29.89000; $120, not $120.00)
- Dollar amounts >= $1,000: use comma separator (e.g. $1,127, $77,772)
- Percentages: always 2 decimal places (e.g. 0.91%, 15.64%)
- Large integers: use comma separator (e.g. 576,471 impressions)

RESPONSE FORMAT RULES:
- Simple factual queries (single number): 1-2 sentences maximum
- Campaign analysis: use bullet points with - prefix (never bullet character)
- Multi-campaign comparisons: use a simple two-column format (Campaign | Value)
- Never use ### or ## headers — this is a chat interface, not a document
- Use **bold** for campaign names and KPI values that are the direct answer
- Use --- as a section divider only when comparing 3+ campaigns
- Maximum 300 words unless the user explicitly asks for more detail

BEHAVIOUR RULES:
- Always cite specific campaign names and dates from the context provided
- When context shows multiple days of data, describe the trend: improving / declining / stable
- If context is from the API (pre-aggregated), the numbers are campaign totals across the full period
- If context is from RAG (daily rows), note the specific date(s) you are referencing
- NEVER say "I don't have data on that" without first considering:
  (a) Is this a date range issue? (data only covers Jan 1-Mar 3, 2026)
  (b) Is the question asking about something outside the 73 campaigns?
  If either: explain the limitation and suggest an alternative
- "Latest" or "most recent" questions: note that results are by relevance not date,
  and suggest using the Campaigns page for the live view

EDGE CASE RESPONSES:
- "all campaigns" questions: note that only a subset is shown, suggest the Campaigns page for the full list
- No data found: suggest rephrasing with a specific product (prod_XX), region (AMS/EMEA/APJ), or date
- Multiple campaigns with similar names: clarify which one you are referring to"""


def _slim_data_for_report(kpi_data: dict) -> dict:
    """Trim full campaign list to only what the report needs."""
    campaigns = kpi_data.get("campaigns", [])

    by_spend = sorted(campaigns, key=lambda c: c.get("total_spent", 0), reverse=True)

    by_cpc = sorted(
        [c for c in campaigns if c.get("clicks", 0) > 0],
        key=lambda c: c.get("cpc", 0),
        reverse=True,
    )

    by_cpl = sorted(
        [c for c in campaigns if c.get("leads", 0) > 0],
        key=lambda c: c.get("cpl", 0),
        reverse=True,
    )

    pacing_counts = {"OVERPACING": 0, "UNDERPACING": 0, "ON TRACK": 0}
    for c in campaigns:
        status = c.get("pacing", {}).get("status", "UNKNOWN")
        if status in pacing_counts:
            pacing_counts[status] += 1

    return {
        "account_summary": kpi_data["account_summary"],
        "total_campaigns": len(campaigns),
        "top_5_by_spend": by_spend[:5],
        "worst_5_cpc": by_cpc[:5],
        "worst_5_cpl": by_cpl[:5],
        "best_5_cpc": by_cpc[-5:] if len(by_cpc) >= 5 else by_cpc[:],
        "best_5_cpl": sorted(
            [c for c in campaigns if c.get("leads", 0) > 0],
            key=lambda c: c.get("cpl", 0),
        )[:5],
        "pacing_summary": pacing_counts,
    }


def _fmt_campaign_list(camps: list[dict]) -> str:
    """Format a list of campaigns as readable lines for the prompt."""
    lines = []
    for c in camps:
        lines.append(
            f"  - {c['name']}: CPC ${c.get('cpc',0):.2f}, CTR {c.get('ctr',0):.2f}%, "
            f"CPL ${c.get('cpl',0):.2f}, Spend ${c.get('total_spent',0):,.2f}"
        )
    return "\n".join(lines) if lines else "  (none)"


async def stream_report(kpi_data: dict[str, Any]) -> AsyncGenerator[str, None]:
    """
    Generate a streaming AI report from slimmed KPI data.

    Args:
        kpi_data: The full output of kpi_engine.aggregate_by_campaign()
                  with pacing data attached.

    Yields:
        Text chunks from Claude's streaming response.
    """
    client = _get_client()
    slim = _slim_data_for_report(kpi_data)
    account = slim["account_summary"]
    kpi_status = account.get("kpi_status", {})
    pacing = slim["pacing_summary"]

    system_prompt = f"""You are an expert LinkedIn Ads analyst for Compound Growth Marketing.
Generate a concise, actionable daily report.

KPI TARGETS:
- CPC: < $5.00 (good = below)
- CTR: > 0.65% (good = above)
- CPL: < $120 (good = below)
- Conv Rate: > 1% (good = above)

ACCOUNT DATA ({account.get('date_from', 'N/A')} to {account.get('date_to', 'N/A')}):
Total campaigns: {slim['total_campaigns']}

ACCOUNT SUMMARY:
CPC: ${account.get('cpc', 0):.2f} ({kpi_status.get('cpc', '').upper()})
CTR: {account.get('ctr', 0):.2f}% ({kpi_status.get('ctr', '').upper()})
CPL: ${account.get('cpl', 0):.2f} ({kpi_status.get('cpl', '').upper()})
Conv Rate: {account.get('conv_rate', 0):.2f}% ({kpi_status.get('conv_rate', '').upper()})
Total Spent: ${account.get('total_spent', 0):,.2f}

TOP 5 BY SPEND:
{_fmt_campaign_list(slim['top_5_by_spend'])}

WORST CPC (top 5):
{_fmt_campaign_list(slim['worst_5_cpc'])}

WORST CPL (top 5):
{_fmt_campaign_list(slim['worst_5_cpl'])}

BEST CPC (top 5):
{_fmt_campaign_list(slim['best_5_cpc'])}

BUDGET PACING:
Overpacing: {pacing['OVERPACING']} campaigns
On Track: {pacing['ON TRACK']} campaigns
Underpacing: {pacing['UNDERPACING']} campaigns

Write a report with these exact sections:

HEALTH SUMMARY
2-3 sentences on overall account health.
Be direct and specific with numbers.

TOP PERFORMERS
Name the 2-3 best campaigns with their key metrics. Explain WHY they perform well.

UNDERPERFORMING
Name the 2-3 worst campaigns with their key metrics. Be specific about what's wrong.

RECOMMENDATIONS
Exactly 3 bullet points. Each must be specific and actionable with numbers.
Example: "Reallocate $X from Campaign A to Campaign B because..."

Keep the total response under 400 words.
Use $ and % symbols. No markdown headers with ##, use plain text section names."""

    try:
        with client.messages.stream(
            model=config.CLAUDE_MODEL,
            max_tokens=600,
            system=system_prompt,
            messages=[{"role": "user", "content": "Generate the daily performance report based on the data above."}],
        ) as stream:
            for text in stream.text_stream:
                yield text
    except Exception as e:
        logger.error(f"Claude report stream error: {e}")
        yield f"\n[Error generating report: {e}]"


async def stream_chat_answer(
    question: str,
    context: str,
    history: list[dict],
    context_type: str = "rag",
) -> AsyncGenerator[str, None]:
    """
    Answer a user's question using context from either Pinecone RAG or the API.

    Args:
        question: The user's natural language question.
        context: Pre-built context string (from get_api_context or query_index).
        history: List of {role, content} dicts — last 6 turns kept.
        context_type: "rag" | "api" | "hybrid"

    Yields:
        Text chunks from Claude's streaming response.
    """
    client = _get_client()

    # Annotate the context block so Claude knows what kind of data it's reading
    if context_type == "api":
        context_header = "DATA SOURCE: Pre-aggregated campaign totals (Jan 1 – Mar 3, 2026)\n"
    elif context_type == "rag":
        context_header = "DATA SOURCE: Daily campaign records from vector search\n"
    else:
        context_header = "DATA SOURCE: Combined — aggregated totals + daily detail records\n"

    if context:
        user_message = f"{context_header}\n{context}\n\nQUESTION: {question}"
    else:
        user_message = (
            f"QUESTION: {question}\n\n"
            f"Note: No relevant campaign data was found for this query. "
            f"Suggest the user rephrase with a specific product code, region, or date range."
        )

    # Keep the last 6 turns of history to stay within context limits
    messages = list(history[-6:]) if history else []
    messages.append({"role": "user", "content": user_message})

    try:
        with client.messages.stream(
            model=config.CLAUDE_CHAT_MODEL,
            max_tokens=600,
            system=CHAT_SYSTEM_PROMPT,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text
    except Exception as e:
        logger.error(f"Claude chat stream error: {e}")
        yield f"\n[Sorry, I encountered an error. Please try again. ({e})]"
