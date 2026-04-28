/**
 * KPIBadge — Displays a KPI value with color based on status.
 * Uses gold (tertiary) for good, rose (error) for bad.
 *
 * Props:
 *   value: string — formatted value to display (e.g. "$3.42", "0.81%")
 *   status: "good" | "bad"
 */
export default function KPIBadge({ value, status }) {
  return (
    <span className={`text-xs font-bold ${status === "good" ? "text-tertiary" : "text-error"}`}>
      {value}
    </span>
  );
}
