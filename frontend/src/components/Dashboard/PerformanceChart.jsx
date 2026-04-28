/**
 * PerformanceChart — Line chart showing spend and clicks over time.
 *
 * Props:
 *   history: array of {date, Spend, Clicks} from useAnalytics hook
 *   loading: boolean
 */
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container-highest border border-outline-variant/20 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-on-surface-variant mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.name === "Spend" ? `$${Number(p.value).toLocaleString()}` : Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function PerformanceChart({ history = [], loading = false }) {
  return (
    <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/5 relative overflow-hidden">
      <div className="flex justify-between items-center mb-8">
        <h4 className="font-headline text-lg font-bold">Performance Over Time</h4>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-outline">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary"></span> Spend
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span> Clicks
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-on-surface-variant text-sm">
          Loading chart data...
        </div>
      ) : history.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-on-surface-variant text-sm">
          No data available for the selected period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <LineChart data={history} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: "#958e9d", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="Spend"
              stroke="#d0bcff"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "#d0bcff" }}
            />
            <Line
              type="monotone"
              dataKey="Clicks"
              stroke="#ecc15c"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 4, fill: "#ecc15c" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
