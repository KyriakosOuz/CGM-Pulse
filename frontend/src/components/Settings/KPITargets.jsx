/**
 * KPITargets — Editable KPI target inputs.
 */
import { useState } from "react";
import { saveKPITargets } from "../../api/client";

const DEFAULTS = { cpc: "5.00", ctr: "0.65", cpl: "120.00", conv_rate: "1.00" };

const TARGET_DEFS = [
  { key: "cpc", label: "CPC Target", unit: "$", description: "Good if below this value" },
  { key: "ctr", label: "CTR Target", unit: "%", description: "Good if above this value" },
  { key: "cpl", label: "CPL Target", unit: "$", description: "Good if below this value" },
  { key: "conv_rate", label: "Conv Rate Target", unit: "%", description: "Good if above this value" },
];

export default function KPITargets({ targets, onTargetsChange }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function handleChange(key, val) {
    onTargetsChange((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await saveKPITargets({
        cpc: parseFloat(targets.cpc),
        ctr: parseFloat(targets.ctr),
        cpl: parseFloat(targets.cpl),
        conv_rate: parseFloat(targets.conv_rate),
      });
      setMsg("Targets updated. Changes take effect on next data refresh.");
    } catch {
      setMsg("Failed to save targets.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    onTargetsChange({ ...DEFAULTS });
    setMsg("Reset to defaults. Click Save to apply.");
  }

  return (
    <div className="bg-surface-container rounded-xl p-6 space-y-5">
      <div>
        <h3 className="font-headline text-base font-bold">KPI Targets</h3>
        <p className="text-xs text-on-surface-variant mt-1">These targets affect all KPI status indicators across the app.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TARGET_DEFS.map(({ key, label, unit, description }) => (
          <div key={key}>
            <label className="text-xs text-on-surface-variant block mb-1.5">
              {label} <span className="text-outline">({unit})</span>
            </label>
            <div className="relative">
              {unit === "$" && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">$</span>}
              <input type="number" lang="en" step="0.01" min="0" value={targets[key]} onChange={(e) => handleChange(key, e.target.value)}
                className={`w-full bg-surface-container-high border border-outline-variant/20 rounded-xl py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none ${unit === "$" ? "pl-7 pr-4" : "pl-4 pr-7"}`} />
              {unit === "%" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-outline text-sm">%</span>}
            </div>
            <p className="text-[10px] text-outline mt-1">{description}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary-container rounded-xl text-sm font-semibold disabled:opacity-50">
          {saving ? "Saving..." : "Save Targets"}
        </button>
        <button onClick={handleReset}
          className="px-5 py-2.5 border border-outline-variant/20 text-sm font-semibold text-on-surface-variant rounded-xl hover:bg-surface-container-high hover:text-on-surface transition-colors">
          Reset to Defaults
        </button>
      </div>
      {msg && <p className="text-xs text-on-surface-variant">{msg}</p>}
    </div>
  );
}
