"""
routers/settings.py — KPI target settings endpoint.
POST /api/settings/targets

Allows the ads specialist to update KPI targets via the Settings UI.
Targets are persisted to data/targets.json so they survive restarts.
"""

import json
import logging
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import config

router = APIRouter(prefix="/api/settings", tags=["settings"])
logger = logging.getLogger(__name__)

TARGETS_FILE = "data/targets.json"


def _load_targets() -> dict:
    defaults = {
        "cpc": 5.00, "ctr": 0.65,
        "cpl": 120.00, "conv_rate": 1.00,
    }
    try:
        os.makedirs("data", exist_ok=True)
        if os.path.exists(TARGETS_FILE):
            with open(TARGETS_FILE) as f:
                saved = json.load(f)
                defaults.update(saved)
    except Exception:
        pass
    return defaults


def _save_targets(targets: dict):
    try:
        os.makedirs("data", exist_ok=True)
        with open(TARGETS_FILE, "w") as f:
            json.dump(targets, f)
        # Patch config module so existing service functions pick up the new values
        config.CPC_TARGET = targets["cpc"]
        config.CTR_TARGET = targets["ctr"]
        config.CPL_TARGET = targets["cpl"]
        config.CONV_RATE_TARGET = targets["conv_rate"]
    except Exception as e:
        logger.error(f"Failed to save targets: {e}")


# Load persisted targets and apply to config on startup
_current_targets = _load_targets()
_save_targets(_current_targets)


class KPITargetsRequest(BaseModel):
    cpc: float = Field(..., gt=0, description="CPC target in dollars. Good if below this value.")
    ctr: float = Field(..., gt=0, description="CTR target as percentage. Good if above this value.")
    cpl: float = Field(..., gt=0, description="CPL target in dollars. Good if below this value.")
    conv_rate: float = Field(..., gt=0, description="Conversion rate target as percentage. Good if above.")


@router.post("/targets")
async def update_kpi_targets(body: KPITargetsRequest):
    """
    Update KPI target thresholds used for 'good'/'bad' status calculations.
    Changes are applied immediately to in-memory targets.
    Targets reset to config.py defaults on server restart.
    """
    global _current_targets
    try:
        _current_targets = {
            "cpc": body.cpc,
            "ctr": body.ctr,
            "cpl": body.cpl,
            "conv_rate": body.conv_rate,
        }

        _save_targets(_current_targets)

        logger.info(f"KPI targets updated: {_current_targets}")
        return {"status": "ok", "targets": _current_targets}
    except Exception as e:
        logger.error(f"POST /api/settings/targets error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/targets")
async def get_kpi_targets():
    """Return the currently active KPI targets."""
    return {"targets": _current_targets}
