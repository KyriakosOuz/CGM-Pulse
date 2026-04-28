"""
services/pinecone_service.py — Pinecone vector store.

Handles embedding, upsert, and semantic query for the RAG chat.

Key improvements over v1:
- Richer chunk format with natural language narrative + parsed campaign components
- Expanded metadata (region, product, audience, KPI status booleans)
- Smart metadata filter extraction from query text
- top_k=20 for better recall
"""

import re
import logging
from typing import Any
from datetime import datetime
from pinecone import Pinecone, ServerlessSpec
import config
from services.embedder import embed_text, embed_batch, embed_query

logger = logging.getLogger(__name__)
_index = None


# ── Month map for chunk text and metadata ──────────────────────────────────
_MONTH_NAMES = {
    "01": "January", "02": "February", "03": "March",
    "04": "April", "05": "May", "06": "June",
    "07": "July", "08": "August", "09": "September",
    "10": "October", "11": "November", "12": "December",
}


def get_index():
    """Lazy-initialise and cache the Pinecone index connection."""
    global _index
    if _index is None:
        pc = Pinecone(api_key=config.PINECONE_API_KEY)
        if config.PINECONE_INDEX_NAME not in pc.list_indexes().names():
            pc.create_index(
                name=config.PINECONE_INDEX_NAME,
                dimension=config.EMBEDDING_DIMENSION,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
            logger.info(f"Created Pinecone index: {config.PINECONE_INDEX_NAME}")
        _index = pc.Index(config.PINECONE_INDEX_NAME)
    return _index


def _parse_campaign_name(name: str) -> dict[str, str]:
    """
    Parse the pipe-delimited campaign name into structured fields.

    Format: "Q1'26 | prod_17a | AMS + EMEA  | Not Consented | GDQA + Procurement team
             | Tofu Conversion | Lead Gen | Document"

    Returns a dict with keys:
        quarter, product, region, audience, targeting, stage, objective, format
    All values default to "" if the field is missing (some older campaigns have
    fewer than 8 pipe-separated parts).
    """
    parts = [p.strip() for p in name.split("|")]

    # Normalise "Singe Image" typo present in source data
    def clean(s: str) -> str:
        return s.replace("Singe Image", "Single Image").strip()

    return {
        "quarter":   clean(parts[0]) if len(parts) > 0 else "",
        "product":   clean(parts[1]) if len(parts) > 1 else "",
        "region":    clean(parts[2]) if len(parts) > 2 else "",
        "audience":  clean(parts[3]) if len(parts) > 3 else "",
        "targeting": clean(parts[4]) if len(parts) > 4 else "",
        "stage":     clean(parts[5]) if len(parts) > 5 else "",
        "objective": clean(parts[6]) if len(parts) > 6 else "",
        "format":    clean(parts[7]) if len(parts) > 7 else "",
    }


def _audience_type(audience: str) -> str:
    """
    Normalise audience field to 'Consented', 'Not Consented', or 'Unknown'.
    Handles variants like 'Consented (Thailand)', 'Not consented', etc.
    """
    a = audience.lower()
    if "not consented" in a or "not consent" in a:
        return "Not Consented"
    if "consented" in a:
        return "Consented"
    return "Unknown"


def _row_to_chunk(row: dict[str, Any]) -> str:
    """
    Convert a Google Sheet row dict into a semantically rich text chunk.

    The chunk has five layers:
    1. Natural language narrative — sentence the embedder can match against queries
    2. Parsed campaign metadata — explicit field names for filter-like matching
    3. Raw KPI numbers — exact values for precise answer generation
    4. Performance verdict — qualitative language for "how is X doing?" queries
    5. Month label — enables "in January" / "in February" matching
    """
    name = row.get(config.SHEET_COL_CAMPAIGN, "Unknown")
    date_str = row.get(config.SHEET_COL_DATE, "Unknown")
    impressions = float(row.get(config.SHEET_COL_IMPRESSIONS, 0) or 0)
    clicks = float(row.get(config.SHEET_COL_CLICKS, 0) or 0)
    spent = float(row.get(config.SHEET_COL_SPENT, 0.0) or 0.0)
    conversions = float(row.get(config.SHEET_COL_CONVERSIONS, 0) or 0)
    leads = float(row.get(config.SHEET_COL_LEADS, 0) or 0)

    # KPI calculations with zero-division guard
    cpc = round(spent / clicks, 2) if clicks > 0 else 0.0
    ctr = round((clicks / impressions) * 100, 4) if impressions > 0 else 0.0
    cpl = round(spent / leads, 2) if leads > 0 else 0.0
    conv_rate = round((conversions / clicks) * 100, 4) if clicks > 0 else 0.0

    # KPI status
    cpc_good = cpc < config.CPC_TARGET
    ctr_good = ctr > config.CTR_TARGET
    cpl_good = cpl < config.CPL_TARGET
    conv_good = conv_rate > config.CONV_RATE_TARGET

    cpc_status = "GOOD" if cpc_good else "BAD"
    ctr_status = "GOOD" if ctr_good else "BAD"
    cpl_status = "GOOD" if cpl_good else "BAD"
    conv_status = "GOOD" if conv_good else "BAD"

    good_count = sum([cpc_good, ctr_good, cpl_good, conv_good])
    all_good = good_count == 4

    # Parse campaign name components
    c = _parse_campaign_name(name)
    quarter = c["quarter"]
    product = c["product"]
    region = c["region"]
    audience = c["audience"]
    stage = c["stage"]
    fmt = c["format"]

    # Audience normalised type
    aud_type = _audience_type(audience)

    # Human-readable date fields
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        month_num = dt.strftime("%m")
        month_name = _MONTH_NAMES.get(month_num, "")
        month_label = f"{month_name} {dt.year}"       # "January 2026"
        month_key = dt.strftime("%Y-%m")               # "2026-01"
    except ValueError:
        month_label = ""
        month_key = ""

    # ── Layer 1: Natural language narrative ────────────────────────────────
    narrative = (
        f"On {date_str} ({month_label}), the {name} campaign "
        f"spent ${spent:,.2f} reaching {int(impressions):,} people "
        f"with {int(clicks):,} clicks."
    )
    if leads > 0:
        narrative += f" It generated {int(leads)} leads."
    if conversions > 0:
        narrative += f" There were {int(conversions)} conversions."

    # ── Layer 2: Parsed campaign components ───────────────────────────────
    components = (
        f"Quarter: {quarter}\n"
        f"Product: {product}\n"
        f"Region: {region}\n"
        f"Audience: {audience}\n"
        f"Audience Type: {aud_type}\n"
        f"Stage: {stage}\n"
        f"Format: {fmt}"
    )

    # ── Layer 3: Raw KPI numbers ───────────────────────────────────────────
    kpi_numbers = (
        f"Campaign: {name}\n"
        f"Date: {date_str}\n"
        f"Impressions: {int(impressions):,} | Clicks: {int(clicks):,} | CTR: {ctr:.2f}%\n"
        f"Total Spent: ${spent:,.2f} | CPC: ${cpc:.2f}\n"
        f"Leads: {int(leads)} | CPL: ${cpl:.2f}\n"
        f"Conversions: {int(conversions)} | Conv Rate: {conv_rate:.2f}%"
    )

    # ── Layer 4: Performance verdict ──────────────────────────────────────
    kpi_labels = [
        ("CPC", cpc_good, f"${cpc:.2f}", "good" if cpc_good else "bad"),
        ("CTR", ctr_good, f"{ctr:.2f}%", "good" if ctr_good else "bad"),
        ("CPL", cpl_good, f"${cpl:.2f}", "good" if cpl_good else "bad"),
        ("Conv Rate", conv_good, f"{conv_rate:.2f}%", "good" if conv_good else "bad"),
    ]

    if all_good:
        verdict_summary = "All 4 KPIs are on target."
    elif good_count == 0:
        verdict_summary = "All 4 KPIs are off target — this campaign needs attention."
    else:
        good_names = [k[0] for k in kpi_labels if k[1]]
        bad_names = [k[0] for k in kpi_labels if not k[1]]
        verdict_summary = (
            f"{good_count} of 4 KPIs on target. "
            f"{', '.join(good_names)} {'is' if len(good_names) == 1 else 'are'} performing well. "
            f"{', '.join(bad_names)} {'needs' if len(bad_names) == 1 else 'need'} attention."
        )

    # Relative performance context
    relative_lines = []
    if cpc > 0:
        if cpc_good:
            rel = round((config.CPC_TARGET - cpc) / config.CPC_TARGET * 100, 1)
            relative_lines.append(f"CPC is {rel}% below the ${config.CPC_TARGET:.2f} target (good).")
        else:
            multiple = round(cpc / config.CPC_TARGET, 1)
            relative_lines.append(
                f"CPC is {multiple}x above the ${config.CPC_TARGET:.2f} target — "
                f"${cpc - config.CPC_TARGET:.2f} over."
            )
    if ctr > 0:
        if ctr_good:
            delta = round(ctr - config.CTR_TARGET, 4)
            relative_lines.append(f"CTR is {delta:.2f}pp above the {config.CTR_TARGET:.2f}% target (good).")
        else:
            delta = round(config.CTR_TARGET - ctr, 4)
            relative_lines.append(
                f"CTR is {delta:.2f}pp below the {config.CTR_TARGET:.2f}% target."
            )
    if cpl > 0:
        if cpl_good:
            savings = round(config.CPL_TARGET - cpl, 2)
            relative_lines.append(f"CPL is ${savings:.2f} below the ${config.CPL_TARGET:.2f} target (good).")
        else:
            multiple = round(cpl / config.CPL_TARGET, 1)
            relative_lines.append(
                f"CPL is {multiple}x above the ${config.CPL_TARGET:.2f} target — "
                f"${cpl - config.CPL_TARGET:.2f} over."
            )

    performance_verdict = (
        f"Performance: {verdict_summary}\n"
        + "\n".join(relative_lines)
    )

    # ── Layer 5: KPI status summary ───────────────────────────────────────
    kpi_status_line = (
        f"KPI Status: CPC {cpc_status} | CTR {ctr_status} | "
        f"CPL {cpl_status} | Conv Rate {conv_status}\n"
        f"Month: {month_label}"
    )

    return "\n\n".join([
        narrative,
        components,
        kpi_numbers,
        performance_verdict,
        kpi_status_line,
    ])


def _row_to_id(row: dict[str, Any]) -> str:
    """Generate a stable Pinecone vector ID from campaign name + date."""
    name = row.get(config.SHEET_COL_CAMPAIGN, "unknown").replace(" ", "_")[:150]
    date = row.get(config.SHEET_COL_DATE, "unknown")
    return f"{name}__{date}"


def _row_to_metadata(row: dict[str, Any], chunk: str) -> dict:
    """
    Build the expanded metadata dict for a Pinecone vector.

    Metadata enables pre-filtering before similarity scoring.
    Filtering to region="APJ" before querying means all top_k results
    are APJ campaigns — not just the most similar ones globally.
    """
    name = row.get(config.SHEET_COL_CAMPAIGN, "")
    date_str = row.get(config.SHEET_COL_DATE, "")
    impressions = float(row.get(config.SHEET_COL_IMPRESSIONS, 0) or 0)
    clicks = float(row.get(config.SHEET_COL_CLICKS, 0) or 0)
    spent = float(row.get(config.SHEET_COL_SPENT, 0.0) or 0.0)
    conversions = float(row.get(config.SHEET_COL_CONVERSIONS, 0) or 0)
    leads = float(row.get(config.SHEET_COL_LEADS, 0) or 0)

    cpc = round(spent / clicks, 2) if clicks > 0 else 0.0
    ctr = round((clicks / impressions) * 100, 4) if impressions > 0 else 0.0
    cpl = round(spent / leads, 2) if leads > 0 else 0.0
    conv_rate = round((conversions / clicks) * 100, 4) if clicks > 0 else 0.0

    cpc_good = cpc < config.CPC_TARGET
    ctr_good = ctr > config.CTR_TARGET
    cpl_good = cpl < config.CPL_TARGET
    conv_good = conv_rate > config.CONV_RATE_TARGET

    c = _parse_campaign_name(name)
    aud_type = _audience_type(c["audience"])

    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        month_key = dt.strftime("%Y-%m")
        quarter = c["quarter"] or f"Q{((dt.month - 1) // 3) + 1}'{str(dt.year)[2:]}"
    except ValueError:
        month_key = ""
        quarter = c["quarter"]

    return {
        # Core identifiers
        "text":             chunk,
        "campaign":         name,
        "date":             date_str,
        "month":            month_key,
        "quarter":          quarter,

        # Parsed campaign components (filterable)
        "product":          c["product"],
        "region":           c["region"],
        "audience":         c["audience"],
        "audience_type":    aud_type,
        "stage":            c["stage"],
        "objective":        c["objective"],
        "format":           c["format"],

        # KPI status booleans (filterable)
        "cpc_status":       "good" if cpc_good else "bad",
        "ctr_status":       "good" if ctr_good else "bad",
        "cpl_status":       "good" if cpl_good else "bad",
        "conv_rate_status": "good" if conv_good else "bad",
        "all_kpis_good":    cpc_good and ctr_good and cpl_good and conv_good,

        # Data presence booleans (filterable)
        "has_leads":        leads > 0,
        "has_conversions":  conversions > 0,
        "has_spend":        spent > 0,
    }


def upsert_rows(rows: list[dict[str, Any]]) -> int:
    """
    Embed all rows and upsert to Pinecone with expanded metadata.

    Uses batches of 100 to stay within Pinecone's upsert limits.

    Returns:
        Number of vectors successfully upserted.
    """
    if not rows:
        return 0

    index = get_index()
    chunks = [_row_to_chunk(row) for row in rows]
    ids = [_row_to_id(row) for row in rows]
    embeddings = embed_batch(chunks)

    vectors = [
        {
            "id": id_,
            "values": embedding,
            "metadata": _row_to_metadata(row, chunk),
        }
        for id_, embedding, chunk, row in zip(ids, embeddings, chunks, rows)
    ]

    # Upsert in batches of 100 (Pinecone recommended batch size)
    batch_size = 100
    total = 0
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        index.upsert(vectors=batch)
        total += len(batch)
        logger.info(f"Upserted {total}/{len(vectors)} vectors to Pinecone.")

    return total


def _extract_filters(question: str) -> dict | None:
    """
    Extract Pinecone metadata filters from the question text.

    Handles: date, month, product, region, audience type, KPI status, format,
    stage, has_leads, quarter.

    Returns:
        A Pinecone filter dict, or None if no filters detected.
    """
    filters = []
    q = question.lower()

    # ── Date filter: YYYY-MM-DD ────────────────────────────────────────────
    date_match = re.search(r'\b(\d{4}-\d{2}-\d{2})\b', question)
    if date_match:
        filters.append({"date": {"$eq": date_match.group(1)}})

    # ── Month filter ───────────────────────────────────────────────────────
    if not date_match:
        month_map = {
            "january":   "2026-01",
            "february":  "2026-02",
            "march":     "2026-03",
        }
        for month_name, month_val in month_map.items():
            if month_name in q:
                filters.append({"month": {"$eq": month_val}})
                break

    # ── Quarter filter ─────────────────────────────────────────────────────
    quarter_match = re.search(r"q([1-4])['\u2019]?(\d{2})", q)
    if quarter_match:
        qnum = quarter_match.group(1)
        yr = quarter_match.group(2)
        filters.append({"quarter": {"$eq": f"Q{qnum}'{yr}"}})

    # ── Product filter ─────────────────────────────────────────────────────
    prod_match = re.search(r'prod[_\s]?(\w+)', q)
    if prod_match:
        raw = prod_match.group(1).lower()
        filters.append({"product": {"$eq": f"prod_{raw}"}})

    # ── Region filter ──────────────────────────────────────────────────────
    if "apj" in q or "thailand" in q or "asia" in q:
        filters.append({"region": {"$eq": "APJ"}})
    elif "worldwide" in q or " ww " in q or q.startswith("ww ") or q.endswith(" ww"):
        filters.append({"region": {"$eq": "WW"}})
    elif "ams" in q and "emea" in q:
        filters.append({"region": {"$eq": "AMS + EMEA"}})
    elif "emea" in q:
        filters.append({"region": {"$eq": "EMEA"}})
    elif "ams" in q and "emea" not in q:
        filters.append({"region": {"$eq": "AMS"}})

    # ── Audience type filter ───────────────────────────────────────────────
    if "not consented" in q or "non-consented" in q or "unconsented" in q:
        filters.append({"audience_type": {"$eq": "Not Consented"}})
    elif "consented" in q:
        filters.append({"audience_type": {"$eq": "Consented"}})

    # ── Stage filter ───────────────────────────────────────────────────────
    if "late stage" in q or "bottom of funnel" in q or "bof" in q:
        filters.append({"stage": {"$eq": "Late Stage Conversion"}})
    elif "tofu" in q or "top of funnel" in q or "awareness" in q:
        filters.append({"stage": {"$eq": "Tofu Conversion"}})
    elif "evaluation" in q or "consideration" in q:
        filters.append({"stage": {"$eq": "Evaluation"}})

    # ── Format filter ──────────────────────────────────────────────────────
    if "document ad" in q or "document format" in q or "doc ad" in q:
        filters.append({"format": {"$eq": "Document"}})
    elif "image ad" in q or "image format" in q or "single image" in q:
        filters.append({"format": {"$in": ["Image", "Single Image"]}})

    # ── KPI status filters ─────────────────────────────────────────────────
    if any(p in q for p in ["off target", "failing", "struggling", "all kpis bad"]):
        filters.append({"all_kpis_good": {"$eq": False}})
    elif any(p in q for p in ["all targets", "all kpis", "hitting all", "all kpis good"]):
        filters.append({"all_kpis_good": {"$eq": True}})

    # ── Has leads filter ───────────────────────────────────────────────────
    if "no leads" in q or "zero leads" in q or "without leads" in q:
        filters.append({"has_leads": {"$eq": False}})
    elif "has leads" in q or "with leads" in q or "generated leads" in q:
        filters.append({"has_leads": {"$eq": True}})

    if not filters:
        return None
    if len(filters) == 1:
        return filters[0]
    return {"$and": filters}


def query_index(question: str, top_k: int = 10) -> list[str]:
    """
    Embed the question and retrieve top-k matching chunks from Pinecone.

    Args:
        question: The user's natural language question.
        top_k: Number of results to return (default 20).

    Returns:
        List of text chunks (the 'text' metadata field from each match).
    """
    index = get_index()
    query_embedding = embed_query(question)

    # Auto-extract filters
    metadata_filter = _extract_filters(question)

    query_kwargs: dict[str, Any] = {
        "vector": query_embedding,
        "top_k": top_k,
        "include_metadata": True,
    }
    if metadata_filter:
        query_kwargs["filter"] = metadata_filter
        logger.debug(f"Pinecone filter: {metadata_filter}")

    try:
        results = index.query(**query_kwargs)
        chunks = [
            m.get("metadata", {}).get("text", "")
            for m in results.get("matches", [])
            if m.get("metadata", {}).get("text")
        ]

        # If filtered query returned nothing, fall back to unfiltered
        if not chunks and metadata_filter:
            logger.info("Filtered query returned 0 results — falling back to unfiltered.")
            del query_kwargs["filter"]
            results = index.query(**query_kwargs)
            chunks = [
                m.get("metadata", {}).get("text", "")
                for m in results.get("matches", [])
                if m.get("metadata", {}).get("text")
            ]

    except Exception as e:
        logger.warning(f"Filtered query failed: {e}. Falling back to unfiltered.")
        results = index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True
        )
        chunks = [
            m.get("metadata", {}).get("text", "")
            for m in results.get("matches", [])
            if m.get("metadata", {}).get("text")
        ]

    logger.info(
        f"Pinecone query returned {len(chunks)} chunks "
        f"(filter={'yes' if metadata_filter else 'none'}, top_k={top_k})"
    )
    return chunks
