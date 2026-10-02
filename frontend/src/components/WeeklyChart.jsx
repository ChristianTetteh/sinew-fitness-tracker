import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { lastNDays } from "../utils/dates";
import { METRIC_LABELS, METRIC_UNITS } from "../utils/metrics";

const COLORS = { walk: "var(--c-walk)", water: "var(--c-water)", sleep: "var(--c-sleep)" };

// Compact axis ticks (2.5k) so the y-axis stays narrow on phones.
const compact = (n) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));
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
  const hasData = chartData.some((d) => d.total > 0);
  const unit = METRIC_UNITS[metric];
  const label = METRIC_LABELS[metric];

  return (
    <div className="chart-card">
      <div className="chart-card-top">
        <h3 className="chart-title">{label}, last 7 days</h3>
        <span className="chart-unit">in {unit}</span>
      </div>
      <div aria-hidden="true" className="chart-plot">
        {!hasData && <p className="chart-empty">Nothing logged in the last 7 days. Your {label.toLowerCase()} will chart here.</p>}
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="var(--muted)"
              tickLine={false}
              axisLine={false}
              fontSize={12.5}
            />
            <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} fontSize={12} tickFormatter={compact} width={38} />
            <Tooltip
              cursor={{ fill: "var(--cursor-highlight)" }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                fontSize: 13,
                color: "var(--text)",
              }}
              formatter={(v) => [`${v} ${unit}`, "Total"]}
            />
            <Bar dataKey="total" fill={COLORS[metric]} radius={[5, 5, 0, 0]} maxBarSize={40}>
              {chartData.map((d, i) => (
                <Cell key={d.fullDay} fillOpacity={i === chartData.length - 1 ? 1 : 0.78} />
              ))}
            </Bar>
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
