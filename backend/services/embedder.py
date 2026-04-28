"""
services/embedder.py — Voyage AI embedding wrapper.
Uses voyage-3-lite for semantic search in Pinecone.
Paid account — large batches with retry on rate limit.
"""

import logging
import time
import voyageai
import config

logger = logging.getLogger(__name__)
_client = None

_BATCH_SIZE = 128  # Voyage max batch size
_COURTESY_PAUSE = 0.5  # Small pause between batches


def _get_client():
    global _client
    if _client is None:
        _client = voyageai.Client(api_key=config.VOYAGE_API_KEY)
    return _client


def embed_text(text: str) -> list[float]:
    """Embed a single document text."""
    try:
        result = _get_client().embed(
            [text],
            model=config.VOYAGE_MODEL,
            input_type="document"
        )
        return result.embeddings[0]
    except Exception as e:
        logger.error(f"Voyage embed_text error: {e}")
        raise


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of document texts.
    Uses large batches (128) with retry on rate-limit errors.
    """
    all_embeddings = []
    total = len(texts)

    for i in range(0, total, _BATCH_SIZE):
        batch = texts[i:i + _BATCH_SIZE]
        batch_num = (i // _BATCH_SIZE) + 1
        total_batches = (total + _BATCH_SIZE - 1) // _BATCH_SIZE

        for attempt in range(3):
            try:
                result = _get_client().embed(
                    batch,
                    model=config.VOYAGE_MODEL,
                    input_type="document"
                )
                all_embeddings.extend(result.embeddings)
                logger.info(f"Embedded batch {batch_num}/{total_batches}")
                break
            except Exception as e:
                if "429" in str(e) or "rate" in str(e).lower():
                    wait = 10 * (attempt + 1)
                    logger.warning(f"Rate limited. Waiting {wait}s...")
                    time.sleep(wait)
                else:
                    raise

        # Small courtesy pause between batches
        if i + _BATCH_SIZE < total:
            time.sleep(_COURTESY_PAUSE)

    logger.info(f"Embedded {len(all_embeddings)} texts total.")
    return all_embeddings


def embed_query(text: str) -> list[float]:
    """
    Embed a user query.
    Uses input_type='query' for better retrieval accuracy.
    """
    try:
        result = _get_client().embed(
            [text],
            model=config.VOYAGE_MODEL,
            input_type="query"
        )
        return result.embeddings[0]
    except Exception as e:
        logger.error(f"Voyage embed_query error: {e}")
        raise
