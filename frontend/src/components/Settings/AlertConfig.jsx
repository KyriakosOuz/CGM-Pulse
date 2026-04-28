/**
 * AlertConfig — Email and Slack alert configuration section.
 */
import { useState, useEffect } from "react";
import { fetchAlertConfig, saveAlertConfig, testAlert } from "../../api/client";

function buildTriggerOptions(targets) {
  return [
    { key: "cpc", label: `Alert when CPC exceeds target (> $${parseFloat(targets.cpc || 5).toFixed(2)})` },
    { key: "ctr", label: `Alert when CTR drops below target (< ${parseFloat(targets.ctr || 0.65).toFixed(2)}%)` },
    { key: "cpl", label: `Alert when CPL exceeds target (> $${parseFloat(targets.cpl || 120).toFixed(0)})` },
    { key: "conv_rate", label: `Alert when Conv Rate drops below target (< ${parseFloat(targets.conv_rate || 1).toFixed(2)}%)` },
    { key: "overpacing", label: "Alert when any campaign is OVERPACING budget" },
  ];
}

export default function AlertConfig({ targets = {} }) {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState("");
  const [triggers, setTriggers] = useState({
    cpc: true, ctr: true, cpl: true, conv_rate: true, overpacing: false,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [testMsg, setTestMsg] = useState("");

  // Load current config from backend on mount
  useEffect(() => {
    fetchAlertConfig().then((cfg) => {
      if (cfg.email) { setEmailTo(cfg.email); setEmailEnabled(true); }
      if (cfg.slack_webhook) { setSlackWebhook(cfg.slack_webhook); setSlackEnabled(true); }
    }).catch(() => {});
  }, []);

  function toggleTrigger(key) {
    setTriggers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      await saveAlertConfig({
        email: emailEnabled ? emailTo : null,
        slack_webhook: slackEnabled ? slackWebhook : null,
        enabled: emailEnabled || slackEnabled,
      });
      setSaveMsg("Saved successfully.");
    } catch {
      setSaveMsg("Failed to save. Check backend logs.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestMsg("");
    try {
      const result = await testAlert();
      const parts = [];
      if (result.email_sent) parts.push("Email sent");
      if (result.slack_sent) parts.push("Slack sent");
      if (!parts.length) parts.push("No channels configured");
      setTestMsg(parts.join(" · "));
    } catch {
      setTestMsg("Test failed. Check credentials.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-surface-container rounded-xl p-6 space-y-6">
      <h3 className="font-headline text-base font-bold">Alert Configuration</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-on-surface">Email Alerts</p>
            <p className="text-xs text-on-surface-variant">Send KPI threshold alerts via email</p>
          </div>
          <button onClick={() => setEmailEnabled((v) => !v)}
            className={`w-12 h-6 rounded-full transition-colors relative ${emailEnabled ? "bg-primary" : "bg-surface-container-high"}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${emailEnabled ? "left-6" : "left-0.5"}`} />
          </button>
        </div>
        {emailEnabled && (
          <>
            <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="Recipient email address" type="email"
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary outline-none" />
            <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-primary text-sm mt-0.5 shrink-0">lock</span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Email delivery is currently limited to the account owner's address. Sending to other recipients will be available once a custom domain is verified in Resend.
              </p>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-on-surface">Slack Alerts</p>
            <p className="text-xs text-on-surface-variant">Post to a Slack channel via webhook</p>
          </div>
          <button onClick={() => setSlackEnabled((v) => !v)}
            className={`w-12 h-6 rounded-full transition-colors relative ${slackEnabled ? "bg-primary" : "bg-surface-container-high"}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${slackEnabled ? "left-6" : "left-0.5"}`} />
          </button>
        </div>
        {slackEnabled && (
          <>
            <input value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..."
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary outline-none" />
            <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-primary text-sm mt-0.5 shrink-0">lock</span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Changing the Slack webhook URL is not yet supported. A custom webhook will be configurable once the domain setup is finalised.
              </p>
            </div>
          </>
        )}
      </div>

      <div>
        <p className="text-xs uppercase text-outline tracking-widest mb-3">Alert Triggers</p>
        <div className="space-y-2">
          {buildTriggerOptions(targets).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={triggers[key]} onChange={() => toggleTrigger(key)} className="w-4 h-4 rounded accent-primary" />
              <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary-container rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity">
          {saving ? "Saving..." : "Save Config"}
        </button>
        <button onClick={handleTest} disabled={testing}
          className="px-5 py-2.5 border border-outline-variant/20 text-sm font-semibold text-on-surface rounded-xl hover:bg-surface-container-high transition-colors disabled:opacity-50">
          {testing ? "Sending..." : "Send Test Alert"}
        </button>
      </div>
      {saveMsg && <p className="text-xs text-tertiary">{saveMsg}</p>}
      {testMsg && <p className="text-xs text-on-surface-variant">{testMsg}</p>}

      {/* Alert previews */}
      <AlertPreviews />
    </div>
  );
}

/* ── Alert Previews ── */

const PREVIEW_ITEMS = [
  { key: "email-alert", label: "KPI Alert Email", icon: "email", img: "/alert-email-preview.png",
    desc: "Branded HTML email sent when a campaign breaches a KPI target. Shows the breached KPI, full 4-metric snapshot, and a direct link to the dashboard." },
  { key: "slack-alert", label: "KPI Alert Slack", icon: "tag", img: "/alert-slack-preview.png",
    desc: "Slack message showing the campaign, breached KPI, deviation %, all 4 KPI values with status indicators, and action buttons." },
  { key: "email-digest", label: "Daily Digest Email", icon: "summarize", img: "/alert-email-digest-preview.png",
    desc: "Daily account health report email sent once per day. Includes account-wide KPIs, the top 10 campaigns needing attention, and a link to the dashboard." },
  { key: "slack-digest", label: "Daily Digest Slack", icon: "forum", img: "/alert-slack-digest-preview.png",
    desc: "Daily digest posted to Slack with account health summary, the worst-performing campaigns by CPC and CPL, and a button to open the dashboard." },
];

function AlertPreviews() {
  const [active, setActive] = useState(null);

  return (
    <div className="pt-4 border-t border-outline-variant/10">
      <p className="text-xs uppercase text-outline tracking-widest mb-3">What alerts look like</p>
      <p className="text-xs text-on-surface-variant mb-3">
        Real alerts and digests sent during testing. Click any to preview.
      </p>
      <div className="flex flex-wrap gap-2">
        {PREVIEW_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => setActive(active === item.key ? null : item.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              active === item.key ? "bg-primary/15 text-primary" : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-sm">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {active && (() => {
        const item = PREVIEW_ITEMS.find((p) => p.key === active);
        return (
          <div className="mt-3 rounded-xl overflow-hidden border border-outline-variant/20">
            <img src={item.img} alt={item.label} className="w-full h-auto" />
            <div className="bg-surface-container-high px-4 py-3">
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                <span className="text-on-surface font-semibold">{item.label}</span> — {item.desc}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
