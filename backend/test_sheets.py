# test_sheets.py
import sys
sys.path.insert(0, ".")
import os
from dotenv import load_dotenv
load_dotenv()

from services.sheets import fetch_all_rows

rows = fetch_all_rows()
print(f"\u2705 Fetched {len(rows)} rows from Google Sheet")
print(f"   First row: {rows[0] if rows else 'EMPTY'}")
print(f"   Columns: {list(rows[0].keys()) if rows else 'N/A'}")
