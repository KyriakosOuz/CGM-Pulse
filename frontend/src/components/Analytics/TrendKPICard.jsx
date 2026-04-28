/**
 * TrendKPICard — KPI card with a 7-point sparkline for the Analytics page.
 */
import Sparkline from "./Sparkline";

export default function TrendKPICard({ label, value, target, status, sparkData = [], trend }) {
  const trendColor = status === "good" ? "text-tertiary bg-tertiary/10" : "text-error bg-error/10";

  return (
    <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/5">
      <div className="flex justify-between items-start mb-3">
        <p className="text-on-surface-variant text-sm font-medium">{label}</p>
        {trend && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${trendColor}`}>
            {trend}
          </span>
        )}
      </div>
      <h3 className="font-headline text-2xl font-extrabold text-on-surface">{value}</h3>
      <p className="text-[10px] text-outline mt-1 uppercase tracking-wider">{target}</p>
      {sparkData.length >= 2 && (
        <div className="mt-3">
          <Sparkline data={sparkData} status={status} />
        </div>
      )}
    </div>
  );
}
