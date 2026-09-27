import { useEffect, useState, useCallback } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import { fullDateLabel } from "../utils/dates";
import Sidebar from "../components/Sidebar.jsx";
import StatCard from "../components/StatCard.jsx";
import QuickLog from "../components/QuickLog.jsx";
import WeeklyChart from "../components/WeeklyChart.jsx";
import ScoreCard from "../components/ScoreCard.jsx";
import RecentEntries from "../components/RecentEntries.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";

const METRICS = ["walk", "water", "sleep"];

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [activeMetric, setActiveMetric] = useState("walk");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [overviewRes, logsRes] = await Promise.all([
      api.get("/logs/summary/overview?days=7"),
      api.get("/logs?days=14"),
    ]);
    setOverview(overviewRes.data);
    setRecentLogs(logsRes.data.logs.slice(0, 10));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleLog(type, value) {
    await api.post("/logs", { type, value });
    await refresh();
  }

  async function handleDelete(id) {
    await api.delete(`/logs/${id}`);
    await refresh();
  }

  async function handleEdit(id, value) {
    await api.put(`/logs/${id}`, { value });
    await refresh();
  }

  if (loading || !overview) return <LoadingScreen />;

  const metricHistory = overview.history.filter((h) => h.type === activeMetric);
  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="dashboard">
      <Sidebar />

      <main className="main">
        <header className="main-header">
          <h1>Good to see you, {firstName}</h1>
          <p className="main-sub">{fullDateLabel()}</p>
        </header>

        <ScoreCard score={overview.score} streak={overview.streak} insight={overview.insight} />

        <QuickLog onLog={handleLog} />

        <section className="stat-grid">
          <StatCard
            label="Steps"
            value={overview.today.walk || 0}
            unit="steps"
            goal={overview.goals.walk}
            accent="#FF6B35"
          />
          <StatCard
            label="Water"
            value={overview.today.water || 0}
            unit="ml"
            goal={overview.goals.water}
            accent="#2DD4BF"
          />
          <StatCard
            label="Sleep"
            value={overview.today.sleep || 0}
            unit="hrs"
            goal={overview.goals.sleep}
            accent="#C9A5FF"
          />
        </section>

        <section className="chart-section">
          <div className="metric-tabs">
            {METRICS.map((m) => (
              <button
                key={m}
                className={`metric-tab ${activeMetric === m ? "is-active" : ""}`}
                onClick={() => setActiveMetric(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <WeeklyChart metric={activeMetric} data={metricHistory} />
        </section>

        <section className="recent-section">
          <span className="stat-label">Recent entries</span>
          <RecentEntries logs={recentLogs} onDelete={handleDelete} onEdit={handleEdit} />
        </section>
      </main>
    </div>
  );
}
