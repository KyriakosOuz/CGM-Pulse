"""
services/sheets.py — Google Sheets API client.
Fetches all rows from the CGM LinkedIn data spreadsheet.
"""

import logging
import os
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

import config

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


def _get_service():
    """Build and return an authenticated Google Sheets service client."""
    # Prefer inline JSON from env var; fall back to file-based credentials
    if config.GOOGLE_SERVICE_ACCOUNT_JSON and config.GOOGLE_SERVICE_ACCOUNT_JSON != {}:
        creds = service_account.Credentials.from_service_account_info(
            config.GOOGLE_SERVICE_ACCOUNT_JSON,
            scopes=SCOPES
        )
    else:
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "./service_account.json")
        creds = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=SCOPES
        )
    return build("sheets", "v4", credentials=creds)


def fetch_all_rows() -> list[dict[str, Any]]:
    """
    Fetch all rows from the Google Sheet and return as a list of dicts.

    Returns:
        List of row dicts with keys matching sheet column headers:
        Date, Campaign name, Impressions, Clicks, Total spent, Conversions, Leads

    Raises:
        RuntimeError: If the sheet cannot be fetched.
    """
    try:
        service = _get_service()
        sheet = service.spreadsheets()
        result = sheet.values().get(
            spreadsheetId=config.GOOGLE_SHEET_ID,
            range=config.SHEET_RANGE
        ).execute()

        values = result.get("values", [])
        if not values or len(values) < 2:
            logger.warning("Sheet is empty or has no data rows.")
            return []

        headers = values[0]
        rows = []
        for i, row in enumerate(values[1:], start=2):
            # Pad short rows with empty strings
            padded = row + [""] * (len(headers) - len(row))
            row_dict = dict(zip(headers, padded))

            # Type coerce numeric fields
            try:
                row_dict[config.SHEET_COL_IMPRESSIONS] = int(
                    str(row_dict.get(config.SHEET_COL_IMPRESSIONS, 0)).replace(",", "") or 0
                )
                row_dict[config.SHEET_COL_CLICKS] = int(
                    str(row_dict.get(config.SHEET_COL_CLICKS, 0)).replace(",", "") or 0
                )
                row_dict[config.SHEET_COL_SPENT] = float(
                    str(row_dict.get(config.SHEET_COL_SPENT, 0)).replace(",", "").replace("$", "") or 0
                )
                row_dict[config.SHEET_COL_CONVERSIONS] = int(
                    str(row_dict.get(config.SHEET_COL_CONVERSIONS, 0)).replace(",", "") or 0
                )
                row_dict[config.SHEET_COL_LEADS] = int(
                    str(row_dict.get(config.SHEET_COL_LEADS, 0)).replace(",", "") or 0
                )
            except (ValueError, TypeError) as e:
                logger.warning(f"Row {i} has invalid numeric data: {e}. Skipping.")
                continue

            rows.append(row_dict)

        logger.info(f"Fetched {len(rows)} data rows from Google Sheet.")
        return rows

    except HttpError as e:
        logger.error(f"Google Sheets API error: {e}")
        raise RuntimeError(f"Failed to fetch sheet: {e}") from e
