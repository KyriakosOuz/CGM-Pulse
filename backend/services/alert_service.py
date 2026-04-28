"""
services/alert_service.py — Email and Slack alerting for KPI threshold breaches.
Rich Slack Block Kit messages and HTML emails via SMTP (Resend).
"""

import logging
from datetime import datetime
import httpx
import config

RESEND_API_URL = "https://api.resend.com/emails"

logger = logging.getLogger(__name__)


# ── Slack (Block Kit) ─────────────────────────────────────────────────


def send_slack_alert(
    campaign_name: str,
    kpi: str,
    current_value: float,
    target: float,
    direction: str,
    all_kpis: dict = None,
    app_url: str = "",
) -> bool:
    """Send a rich Slack alert via incoming webhook using Block Kit."""
    if not config.SLACK_WEBHOOK_URL:
        logger.warning("Slack alert skipped: SLACK_WEBHOOK_URL not configured.")
        return False

    try:
        pct_off = abs((current_value - target) / target * 100) if target else 0
        color = "#FF4444" if pct_off > 50 else "#FF8C00" if pct_off > 20 else "#FFB347"

        # Build KPI context fields
        kpi_fields = []
        if all_kpis:
            kpi_map = {
                "cpc": ("CPC", "$", "", 5.00, "below"),
                "ctr": ("CTR", "", "%", 0.65, "above"),
                "cpl": ("CPL", "$", "", 120.00, "below"),
                "conv_rate": ("Conv Rate", "", "%", 1.00, "above"),
            }
            for key, (label, pre, suf, tgt, dir_) in kpi_map.items():
                val = all_kpis.get(key, 0)
                is_bad = val > tgt if dir_ == "below" else val < tgt
                status = "\U0001f534" if is_bad else "\U0001f7e2"
                kpi_fields.append({
                    "type": "mrkdwn",
                    "text": f"*{label}*\n{status} {pre}{val:.2f}{suf} (target: {pre}{tgt}{suf})",
                })

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"\u26a0\ufe0f CGM Pulse Alert: {kpi} Threshold Breached",
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*Campaign:* {campaign_name}\n"
                        f"*{kpi}* is `{current_value:.2f}` — target is {direction} `{target:.2f}`\n"
                        f"*Deviation:* {pct_off:.1f}% off target"
                    ),
                },
            },
        ]

        if kpi_fields:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": "*Full KPI Snapshot:*"},
            })
            for i in range(0, len(kpi_fields), 2):
                blocks.append({"type": "section", "fields": kpi_fields[i : i + 2]})

        dashboard_url = app_url or config.FRONTEND_URL
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "\U0001f4ca Open Dashboard"},
                    "url": dashboard_url,
                    "style": "primary",
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "\U0001f4cb View Campaigns"},
                    "url": f"{dashboard_url}/campaigns",
                },
            ],
        })

        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"\U0001f550 {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')} | CGM Pulse Monitoring",
                }
            ],
        })

        payload = {"attachments": [{"color": color, "blocks": blocks}]}

        response = httpx.post(config.SLACK_WEBHOOK_URL, json=payload, timeout=10)
        response.raise_for_status()
        logger.info(f"Slack alert sent for {campaign_name} — {kpi}")
        return True
    except Exception as e:
        logger.error(f"Slack alert failed: {e}")
        return False


# ── Email (HTML via SMTP / Resend) ────────────────────────────────────


def _build_kpi_rows_html(all_kpis: dict) -> str:
    """Build HTML table rows for the KPI snapshot."""
    if not all_kpis:
        return ""

    kpi_map = [
        ("CPC", "cpc", "$", "", 5.00, "below"),
        ("CTR", "ctr", "", "%", 0.65, "above"),
        ("CPL", "cpl", "$", "", 120.00, "below"),
        ("Conv Rate", "conv_rate", "", "%", 1.00, "above"),
    ]

    rows = ""
    for label, key, pre, suf, tgt, dir_ in kpi_map:
        val = all_kpis.get(key, 0)
        is_bad = val > tgt if dir_ == "below" else val < tgt
        status_color = "#FF4444" if is_bad else "#22C55E"
        status_icon = "\u2717" if is_bad else "\u2713"
        rows += f"""
            <tr>
              <td style="padding:10px 16px;color:#9CA3AF;font-size:13px;">{label}</td>
              <td style="padding:10px 16px;font-weight:600;font-size:13px;color:{status_color};">{pre}{val:.2f}{suf}</td>
              <td style="padding:10px 16px;color:#6B7280;font-size:12px;">target: {dir_} {pre}{tgt}{suf}</td>
              <td style="padding:10px 16px;text-align:center;font-size:16px;color:{status_color};">{status_icon}</td>
            </tr>"""
    return rows


def send_email_alert(
    campaign_name: str,
    kpi: str,
    current_value: float,
    target: float,
    direction: str,
    all_kpis: dict = None,
    app_url: str = "",
) -> bool:
    """Send a rich HTML email alert via SMTP (Resend)."""
    if not all([config.SMTP_PASSWORD, config.ALERT_FROM_EMAIL, config.ALERT_TO_EMAIL]):
        logger.warning("Email alert skipped: SMTP credentials not configured.")
        return False

    try:
        pct_off = abs((current_value - target) / target * 100) if target else 0
        dashboard_url = app_url or config.FRONTEND_URL
        kpi_rows = _build_kpi_rows_html(all_kpis)
        now_str = datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")

        kpi_table_section = ""
        if kpi_rows:
            kpi_table_section = f"""
              <tr><td style="background:#1F1E2A;padding:0 32px 24px;border-left:1px solid #2D2B3D;border-right:1px solid #2D2B3D;">
                <p style="margin:0 0 12px;color:#6B7280;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Full KPI Snapshot</p>
                <table width="100%" style="border-collapse:collapse;">
                  <tr style="background:#292935;">
                    <td style="padding:8px 16px;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;">Metric</td>
                    <td style="padding:8px 16px;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;">Value</td>
                    <td style="padding:8px 16px;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;">Target</td>
                    <td style="padding:8px 16px;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;text-align:center;">Status</td>
                  </tr>
                  {kpi_rows}
                </table>
              </td></tr>"""

        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0F0F1A;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F1A;min-height:100vh;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#7C3AED,#4F46E5);padding:32px;border-radius:12px 12px 0 0;">
          <table width="100%"><tr>
            <td>
              <p style="margin:0;color:#A78BFA;font-size:11px;letter-spacing:2px;text-transform:uppercase;">CGM Pulse Monitoring</p>
              <h1 style="margin:8px 0 0;color:#FFFFFF;font-size:22px;font-weight:700;">\u26a0\ufe0f KPI Alert</h1>
            </td>
            <td align="right">
              <span style="background:rgba(255,255,255,0.15);color:white;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;">{pct_off:.0f}% off target</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Campaign name -->
        <tr><td style="background:#1F1E2A;padding:24px 32px;border-left:1px solid #2D2B3D;border-right:1px solid #2D2B3D;">
          <p style="margin:0 0 4px;color:#6B7280;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Campaign</p>
          <p style="margin:0;color:#E3E0F1;font-size:15px;font-weight:600;line-height:1.4;">{campaign_name}</p>
        </td></tr>

        <!-- Breached KPI highlight -->
        <tr><td style="background:#1F1E2A;padding:0 32px 24px;border-left:1px solid #2D2B3D;border-right:1px solid #2D2B3D;">
          <table width="100%" style="background:#FF444415;border:1px solid #FF444430;border-radius:8px;border-left:4px solid #FF4444;">
            <tr><td style="padding:16px;">
              <p style="margin:0 0 4px;color:#FF6B6B;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Threshold Breached</p>
              <p style="margin:0;color:#FFFFFF;font-size:24px;font-weight:700;">{kpi}: {current_value:.2f}</p>
              <p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">Target: {direction} {target:.2f} ({pct_off:.1f}% off)</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- KPI Table -->
        {kpi_table_section}

        <!-- CTA Buttons -->
        <tr><td style="background:#1F1E2A;padding:24px 32px;border-left:1px solid #2D2B3D;border-right:1px solid #2D2B3D;">
          <table><tr>
            <td style="padding-right:12px;">
              <a href="{dashboard_url}" style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#4F46E5);color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Open Dashboard \u2192</a>
            </td>
            <td>
              <a href="{dashboard_url}/campaigns" style="display:inline-block;background:transparent;color:#A78BFA;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;border:1px solid #4A4452;">View Campaigns</a>
            </td>
          </tr></table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#12121D;padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid #2D2B3D;">
          <p style="margin:0;color:#4B5563;font-size:12px;">
            CGM Pulse \u00b7 LinkedIn Ads Intelligence<br/>
            {now_str}<br/>
            <span style="color:#374151;">You\u2019re receiving this because KPI alerts are enabled in CGM Pulse Settings.</span>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

        subject = f"\u26a0\ufe0f CGM Pulse: {kpi} alert \u2014 {campaign_name[:50]}"

        response = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {config.SMTP_PASSWORD}",
                "Content-Type": "application/json",
            },
            json={
                "from": config.ALERT_FROM_EMAIL,
                "to": [config.ALERT_TO_EMAIL],
                "subject": subject,
                "html": html,
            },
            timeout=15,
        )
        if response.status_code >= 400:
            logger.error(f"Resend API error {response.status_code}: {response.text}")
            return False

        logger.info(f"Email alert sent to {config.ALERT_TO_EMAIL} for {campaign_name} — {kpi}")
        return True
    except Exception as e:
        logger.error(f"Email alert failed: {e}")
        return False


# ── Daily Digest ──────────────────────────────────────────────────────


def send_daily_digest_slack(bad_campaigns: list[dict], account_summary: dict) -> bool:
    """Send ONE Slack message summarizing all off-target campaigns for the day."""
    if not config.SLACK_WEBHOOK_URL:
        return False
    try:
        total = len(bad_campaigns)
        worst_5 = sorted(bad_campaigns, key=lambda c: c.get("cpc", 0), reverse=True)[:5]

        campaign_lines = "\n".join(
            f"\u2022 *{c['name'][:60]}* \u2014 CPC: ${c.get('cpc', 0):.2f} | CPL: ${c.get('cpl', 0):.2f}"
            for c in worst_5
        )

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "\U0001f4ca CGM Pulse Daily Digest"},
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*Account Health Summary*\n"
                        f"CPC: ${account_summary.get('cpc', 0):.2f} | "
                        f"CTR: {account_summary.get('ctr', 0):.2f}% | "
                        f"CPL: ${account_summary.get('cpl', 0):.2f}\n\n"
                        f"*{total} campaigns need attention:*\n"
                        f"{campaign_lines}"
                        f"{chr(10) + '_...and more_' if total > 5 else ''}"
                    ),
                },
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "\U0001f4ca Open Dashboard"},
                        "url": config.FRONTEND_URL,
                        "style": "primary",
                    }
                ],
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"\U0001f550 {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')} | Daily Digest",
                    }
                ],
            },
        ]

        response = httpx.post(config.SLACK_WEBHOOK_URL, json={"blocks": blocks}, timeout=10)
        response.raise_for_status()
        logger.info(f"Daily digest Slack sent — {total} campaigns flagged.")
        return True
    except Exception as e:
        logger.error(f"Digest Slack failed: {e}")
        return False


def send_daily_digest_email(bad_campaigns: list[dict], account_summary: dict) -> bool:
    """Send ONE summary email per day with account health + worst 10 campaigns."""
    if not all([config.SMTP_PASSWORD, config.ALERT_FROM_EMAIL, config.ALERT_TO_EMAIL]):
        logger.warning("Digest email skipped: SMTP credentials not configured.")
        return False

    try:
        total = len(bad_campaigns)
        worst_10 = sorted(bad_campaigns, key=lambda c: c.get("cpc", 0), reverse=True)[:10]
        now_str = datetime.utcnow().strftime("%B %d, %Y")

        campaign_rows = "".join(
            f"""<tr>
              <td style="padding:8px 12px;font-size:12px;color:#E3E0F1;border-bottom:1px solid #2D2B3D;">{c['name'][:55]}{'...' if len(c['name']) > 55 else ''}</td>
              <td style="padding:8px 12px;font-size:12px;color:#FF6B6B;border-bottom:1px solid #2D2B3D;">${c.get('cpc', 0):.2f}</td>
              <td style="padding:8px 12px;font-size:12px;color:#FF6B6B;border-bottom:1px solid #2D2B3D;">${c.get('cpl', 0):.2f}</td>
              <td style="padding:8px 12px;font-size:12px;color:#9CA3AF;border-bottom:1px solid #2D2B3D;">{c.get('status', '')}</td>
            </tr>"""
            for c in worst_10
        )

        # Determine colors for account KPIs
        def kpi_color(key, val):
            targets = {"cpc": (5.0, "below"), "ctr": (0.65, "above"), "cpl": (120.0, "below"), "conv_rate": (1.0, "above")}
            tgt, direction = targets.get(key, (0, "below"))
            is_bad = val > tgt if direction == "below" else val < tgt
            return "#FF6B6B" if is_bad else "#22C55E"

        cpc_val = account_summary.get("cpc", 0)
        ctr_val = account_summary.get("ctr", 0)
        cpl_val = account_summary.get("cpl", 0)
        conv_val = account_summary.get("conv_rate", 0)

        html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0F0F1A;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F1A;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr><td style="background:linear-gradient(135deg,#7C3AED,#4F46E5);padding:28px 32px;border-radius:12px 12px 0 0;">
          <p style="margin:0;color:#A78BFA;font-size:11px;letter-spacing:2px;text-transform:uppercase;">CGM Pulse \u00b7 Daily Digest</p>
          <h1 style="margin:8px 0 0;color:white;font-size:20px;font-weight:700;">\U0001f4ca Account Health Report</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">{now_str}</p>
        </td></tr>

        <tr><td style="background:#1F1E2A;padding:24px 32px;border-left:1px solid #2D2B3D;border-right:1px solid #2D2B3D;">
          <table width="100%"><tr>
            <td style="text-align:center;padding:12px;">
              <p style="margin:0;color:#9CA3AF;font-size:11px;text-transform:uppercase;">Avg CPC</p>
              <p style="margin:4px 0 0;color:{kpi_color('cpc', cpc_val)};font-size:22px;font-weight:700;">${cpc_val:.2f}</p>
              <p style="margin:2px 0 0;color:#6B7280;font-size:11px;">target &lt; $5.00</p>
            </td>
            <td style="text-align:center;padding:12px;">
              <p style="margin:0;color:#9CA3AF;font-size:11px;text-transform:uppercase;">Avg CTR</p>
              <p style="margin:4px 0 0;color:{kpi_color('ctr', ctr_val)};font-size:22px;font-weight:700;">{ctr_val:.2f}%</p>
              <p style="margin:2px 0 0;color:#6B7280;font-size:11px;">target &gt; 0.65%</p>
            </td>
            <td style="text-align:center;padding:12px;">
              <p style="margin:0;color:#9CA3AF;font-size:11px;text-transform:uppercase;">Avg CPL</p>
              <p style="margin:4px 0 0;color:{kpi_color('cpl', cpl_val)};font-size:22px;font-weight:700;">${cpl_val:.2f}</p>
              <p style="margin:2px 0 0;color:#6B7280;font-size:11px;">target &lt; $120</p>
            </td>
            <td style="text-align:center;padding:12px;">
              <p style="margin:0;color:#9CA3AF;font-size:11px;text-transform:uppercase;">Conv Rate</p>
              <p style="margin:4px 0 0;color:{kpi_color('conv_rate', conv_val)};font-size:22px;font-weight:700;">{conv_val:.2f}%</p>
              <p style="margin:2px 0 0;color:#6B7280;font-size:11px;">target &gt; 1%</p>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="background:#1F1E2A;padding:0 32px 24px;border-left:1px solid #2D2B3D;border-right:1px solid #2D2B3D;">
          <p style="margin:0 0 12px;color:#6B7280;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Top 10 Campaigns Needing Attention ({total} total)</p>
          <table width="100%" style="border-collapse:collapse;">
            <tr style="background:#292935;">
              <td style="padding:8px 12px;color:#6B7280;font-size:11px;font-weight:600;">Campaign</td>
              <td style="padding:8px 12px;color:#6B7280;font-size:11px;font-weight:600;">CPC</td>
              <td style="padding:8px 12px;color:#6B7280;font-size:11px;font-weight:600;">CPL</td>
              <td style="padding:8px 12px;color:#6B7280;font-size:11px;font-weight:600;">Status</td>
            </tr>
            {campaign_rows}
          </table>
        </td></tr>

        <tr><td style="background:#1F1E2A;padding:24px 32px;border-left:1px solid #2D2B3D;border-right:1px solid #2D2B3D;">
          <a href="{config.FRONTEND_URL}" style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#4F46E5);color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Open CGM Pulse Dashboard \u2192</a>
        </td></tr>

        <tr><td style="background:#12121D;padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid #2D2B3D;">
          <p style="margin:0;color:#4B5563;font-size:11px;">This digest is sent once daily at 9am UTC. Manage alerts in CGM Pulse \u2192 Settings.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>"""

        subject = f"\U0001f4ca CGM Pulse Daily Digest \u2014 {total} campaigns need attention \u00b7 {now_str}"

        response = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {config.SMTP_PASSWORD}",
                "Content-Type": "application/json",
            },
            json={
                "from": config.ALERT_FROM_EMAIL,
                "to": [config.ALERT_TO_EMAIL],
                "subject": subject,
                "html": html,
            },
            timeout=15,
        )
        if response.status_code >= 400:
            logger.error(f"Resend digest API error {response.status_code}: {response.text}")
            return False

        logger.info(f"Daily digest email sent to {config.ALERT_TO_EMAIL} — {total} campaigns flagged.")
        return True
    except Exception as e:
        logger.error(f"Digest email failed: {e}")
        return False
