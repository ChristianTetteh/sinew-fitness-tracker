import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const COLORS = { walk: "#FF6B35", water: "#2DD4BF", sleep: "#C9A5FF" };
const UNITS = { walk: "steps", water: "ml", sleep: "hrs" };

function formatDay(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export default function WeeklyChart({ metric, data }) {
  const chartData = data.map((d) => ({ day: formatDay(d.logged_at), total: d.total }));

  return (
    <div className="chart-card">
      <div className="chart-card-top">
        <span className="stat-label">Last 7 days · {metric}</span>
      </div>
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
            formatter={(v) => [`${v} ${UNITS[metric]}`, "Total"]}
          />
          <Bar dataKey="total" fill={COLORS[metric]} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
