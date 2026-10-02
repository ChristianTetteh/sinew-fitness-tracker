import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { lastNDays } from "../utils/dates";
import { METRIC_LABELS, METRIC_UNITS } from "../utils/metrics";

const COLORS = { walk: "#FF6B35", water: "#2DD4BF", sleep: "#C9A5FF" };
const WINDOW_DAYS = 7;

// data: [{ logged_at: "YYYY-MM-DD", total }] for one metric. endDate is the server's
// "today"; the chart always shows the 7 days ending there, with 0 for days without entries.
export default function WeeklyChart({ metric, data, endDate }) {
  const totals = new Map(data.map((d) => [d.logged_at.slice(0, 10), d.total]));
  const chartData = lastNDays(WINDOW_DAYS, endDate).map(({ key, date }) => ({
    day: date.toLocaleDateString(undefined, { weekday: "short" }),
    fullDay: date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
    total: totals.get(key) || 0,
  }));
  const unit = METRIC_UNITS[metric];
  const label = METRIC_LABELS[metric];

  return (
    <div className="chart-card">
      <div className="chart-card-top">
        <span className="stat-label">Last 7 days · {label}</span>
      </div>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="var(--muted)"
              tickLine={false}
              axisLine={false}
              fontSize={13}
            />
            <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip
              cursor={{ fill: "var(--cursor-highlight)" }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
              }}
              formatter={(v) => [`${v} ${unit}`, "Total"]}
            />
            <Bar dataKey="total" fill={COLORS[metric]} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Text alternative for the chart: the same numbers as a screen-reader-only table. */}
      <table className="sr-only">
        <caption>
          {label} per day, last 7 days
        </caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Total ({unit})</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((d) => (
            <tr key={d.fullDay}>
              <th scope="row">{d.fullDay}</th>
              <td>{d.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
