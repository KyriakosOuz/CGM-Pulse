/**
 * KPICard — Displays a single KPI metric with status coloring and badge.
 *
 * Props:
 *   label: string — e.g. "Avg. CPC"
 *   value: string — formatted value e.g. "$3.42"
 *   target: string — target description e.g. "Target: < $5.00"
 *   trend: string — e.g. "↓ 12%" or "↑ 0.14%"
 *   status: "good" | "bad"
 */
export default function KPICard({ label, value, target, trend, status }) {
  const isGood = status === "good";
  const valueColor = isGood ? "text-tertiary" : "text-error";
  const badgeClasses = isGood
    ? "text-tertiary bg-tertiary/10"
    : "text-error bg-error/10";
  const borderAccent = isGood
    ? "border-tertiary/20"
    : "border-error/20";

  return (
    <div className={`bg-surface-container p-5 lg:p-6 rounded-xl border ${borderAccent}`}>
      <div className="flex justify-between items-start mb-1">
        <p className="text-on-surface-variant text-[11px] lg:text-sm font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <h3 className={`font-headline text-2xl lg:text-3xl font-extrabold ${valueColor}`}>{value}</h3>
      <div className="flex items-center gap-2 mt-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeClasses}`}>
          {isGood ? "On Target" : "Off Target"}
        </span>
        {trend && (
          <span className={`text-[10px] ${isGood ? "text-tertiary/70" : "text-error/70"}`}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-[10px] text-outline mt-1.5 uppercase tracking-wider">{target}</p>
    </div>
  );
}
