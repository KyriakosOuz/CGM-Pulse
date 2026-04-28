// webhook_trigger.gs
// Deploy this in Google Apps Script bound to your spreadsheet.
// After deploying as a web app, add triggers for onEdit and onChange.

const WEBHOOK_URL = "https://YOUR-RAILWAY-BACKEND.railway.app/webhook/sheet-update";

/**
 * Trigger this via Apps Script > Triggers > onEdit (spreadsheet)
 * Fires when any cell is edited.
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  const row = range.getRow();

  // Skip header row
  if (row === 1) return;

  sendRowToWebhook(sheet, row);
}

/**
 * Trigger this via Apps Script > Triggers > onChange (spreadsheet)
 * Fires when rows are inserted (e.g., daily auto-update adds a new row).
 */
function onChange(e) {
  if (e.changeType !== "INSERT_ROW") return;

  const sheet = e.source.getActiveSheet();
  const lastRow = sheet.getLastRow();
  sendRowToWebhook(sheet, lastRow);
}

function sendRowToWebhook(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, 7).getValues()[0];
  const rowValues = sheet.getRange(row, 1, 1, 7).getValues()[0];

  const payload = {
    date: rowValues[0] instanceof Date
      ? Utilities.formatDate(rowValues[0], "UTC", "yyyy-MM-dd")
      : String(rowValues[0]),
    campaign_name: String(rowValues[1]),
    impressions: parseInt(rowValues[2]) || 0,
    clicks: parseInt(rowValues[3]) || 0,
    total_spent: parseFloat(rowValues[4]) || 0,
    conversions: parseInt(rowValues[5]) || 0,
    leads: parseInt(rowValues[6]) || 0
  };

  try {
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    console.log("Webhook response:", response.getContentText());
  } catch (err) {
    console.error("Webhook failed:", err);
  }
}

// ── DEPLOYMENT INSTRUCTIONS ────────────────────────────────
// 1. In Google Sheets: Extensions > Apps Script
// 2. Paste this code into Code.gs
// 3. Click Deploy > New Deployment
//    - Type: Web app
//    - Execute as: Me
//    - Who has access: Anyone (or restrict to your Railway IP)
// 4. Copy the web app URL — you don't need it for triggers,
//    but it's useful for testing
// 5. Click Triggers (clock icon) > Add Trigger:
//    a. Function: onEdit, Event source: From spreadsheet, Event type: On edit
//    b. Function: onChange, Event source: From spreadsheet, Event type: On change
// 6. Replace YOUR-RAILWAY-BACKEND with your actual Railway URL
