"""
config.py — Central configuration for CGM Pulse backend.
All environment variables and KPI constants live here.
"""

import os
import json
from dotenv import load_dotenv

load_dotenv()

# ── Google Sheets ──────────────────────────────────────────
GOOGLE_SHEET_ID: str = os.getenv(
    "GOOGLE_SHEET_ID",
    "1bkmvmKsrjnI_nHdmw1wFc_MCGGDYY3QGu36or8mBK3w"
)
GOOGLE_SERVICE_ACCOUNT_JSON: dict = json.loads(
    os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "{}")
)

# ── Anthropic ──────────────────────────────────────────────
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL: str = "claude-sonnet-4-5"
CLAUDE_CHAT_MODEL: str = "claude-haiku-4-5"  # Faster model for interactive chat

# ── Voyage AI ──────────────────────────────────────────────
VOYAGE_API_KEY: str = os.getenv("VOYAGE_API_KEY", "")
VOYAGE_MODEL: str = "voyage-3-lite"
EMBEDDING_DIMENSION: int = 512  # voyage-3-lite outputs 512 dimensions

# ── Pinecone ───────────────────────────────────────────────
PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "cgm-pulse")

# ── Alerts ─────────────────────────────────────────────────
SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.resend.com")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER: str = os.getenv("SMTP_USER", "resend")
SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
ALERT_FROM_EMAIL: str = os.getenv("ALERT_FROM_EMAIL", "")
ALERT_TO_EMAIL: str = os.getenv("ALERT_TO_EMAIL", "")
SLACK_WEBHOOK_URL: str = os.getenv("SLACK_WEBHOOK_URL", "")

# ── App ────────────────────────────────────────────────────
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
PORT: int = int(os.getenv("PORT", "8000"))

# ── Alert Controls ─────────────────────────────────────────
ALERTS_ENABLED: bool = os.getenv("ALERTS_ENABLED", "false").lower() == "true"
ALERT_MAX_PER_CYCLE: int = int(os.getenv("ALERT_MAX_PER_CYCLE", "1"))
ALERT_COOLDOWN_HOURS: int = int(os.getenv("ALERT_COOLDOWN_HOURS", "24"))

# ── KPI Targets (never change without explicit instruction) ─
CPC_TARGET: float = 5.00      # Good if BELOW this
CTR_TARGET: float = 0.65      # Good if ABOVE this (expressed as %)
CPL_TARGET: float = 120.00    # Good if BELOW this
CONV_RATE_TARGET: float = 1.00  # Good if ABOVE this (expressed as %)

# ── Campaign Budgets ────────────────────────────────────────
# Used by budget_pacing.py. Keys are exact campaign names from the Sheet.
# The "default" key is the fallback for any campaign with no historical data.
# Override per-campaign at runtime via CAMPAIGN_BUDGETS env var (JSON dict):
#   export CAMPAIGN_BUDGETS='{"Enterprise Core Q3": 20000.00, "default": 12000.00}'
# Values in the env var always win over the hardcoded defaults below.
_env_campaign_budgets: dict = json.loads(os.getenv("CAMPAIGN_BUDGETS", "{}"))
CAMPAIGN_BUDGETS: dict[str, float] = {
    "default": 15000.00,   # fallback for any campaign with no historical spend data
    **_env_campaign_budgets,  # env var overrides — including "default" if set
}

# ── Google Sheet Column Names (case-sensitive) ──────────────
SHEET_COL_DATE = "Date"
SHEET_COL_CAMPAIGN = "Campaign name"
SHEET_COL_IMPRESSIONS = "Impressions"
SHEET_COL_CLICKS = "Clicks"
SHEET_COL_SPENT = "Total spent"
SHEET_COL_CONVERSIONS = "Conversions"
SHEET_COL_LEADS = "Leads"

SHEET_RANGE = "A:G"  # All 7 columns

# ── Dataset Window ──────────────────────────────────────────
# Official end date of the assignment dataset. Pacing math anchors here
# rather than to the Sheet's max date so a stray late-dated row can't
# skew expected_spend or the dashboard's period bounds.
# Override via env var DATASET_END_DATE=YYYY-MM-DD if the dataset is
# extended later.
from datetime import date as _date, datetime as _datetime
_dataset_end_str = os.getenv("DATASET_END_DATE", "2026-03-03")
try:
    DATASET_END_DATE: _date = _datetime.strptime(_dataset_end_str, "%Y-%m-%d").date()
except ValueError:
    DATASET_END_DATE = _date(2026, 3, 3)
