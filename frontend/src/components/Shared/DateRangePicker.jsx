/**
 * DateRangePicker — Pill selector for preset ranges + custom date inputs.
 *
 * Props:
 *   value: { preset: string, from: string, to: string }
 *   onChange: (newValue) => void
 */
const PRESETS = [
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

export default function DateRangePicker({ value, onChange }) {
  function selectPreset(key) {
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);

    let from = "";
    let to = fmt(today);

    if (key === "7d") {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      from = fmt(d);
    } else if (key === "30d") {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      from = fmt(d);
    } else if (key === "month") {
      from = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
    } else {
      from = value.from || fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      to = value.to || fmt(today);
    }

    onChange({ preset: key, from, to });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${value.preset === p.key
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:text-on-surface"
              }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            min="2026-01-01"
            max="2026-03-03"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-1 focus:ring-primary outline-none"
          />
          <span className="text-on-surface-variant text-xs">to</span>
          <input
            type="date"
            min="2026-01-01"
            max="2026-03-03"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
      )}
    </div>
  );
}
