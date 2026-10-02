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
import DashboardSkeleton from "../components/DashboardSkeleton.jsx";
import ErrorScreen from "../components/ErrorScreen.jsx";
import { IconAlert } from "../components/Icons.jsx";
import { METRIC_LABELS } from "../utils/metrics";

const METRICS = ["walk", "water", "sleep"];

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [activeMetric, setActiveMetric] = useState("walk");
  const [loading, setLoading] = useState(true);
  // { message, retry } for the visible error banner; null when everything is fine.
  const [problem, setProblem] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [overviewRes, logsRes] = await Promise.all([
        api.get("/logs/summary/overview?days=7"),
        api.get("/logs?days=14"),
      ]);
      setOverview(overviewRes.data);
      setRecentLogs(logsRes.data.logs.slice(0, 10));
      setProblem(null);
    } catch (err) {
      setProblem({
        message: err.response?.data?.error || "Couldn't load your dashboard. Check your connection and try again.",
        retry: refresh,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Log and edit rethrow so the form that triggered them can show the server's message
  // (e.g. "over the daily cap") next to the input. The reload afterwards handles its own errors.
  async function handleLog(type, value) {
    await api.post("/logs", { type, value });
    await refresh();
  }

  async function handleEdit(id, value) {
    await api.put(`/logs/${id}`, { value });
    await refresh();
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/logs/${id}`);
    } catch (err) {
      setProblem({
        message: err.response?.data?.error || "Couldn't remove that entry. Try again.",
        retry: () => handleDelete(id),
      });
      return;
    }
    await refresh();
  }

  if (loading) return <DashboardSkeleton />;
  if (!overview) {
    const retry = () => {
      setLoading(true);
      refresh();
    };
    return <ErrorScreen message={problem?.message || "Couldn't load your dashboard."} onRetry={retry} />;
  }

  const metricHistory = overview.history.filter((h) => h.type === activeMetric);
  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="dashboard">
      <Sidebar />

      <main className="main">
        <header className="main-header">
          <h1>Hi, {firstName}</h1>
          <p className="main-sub">{fullDateLabel()}</p>
        </header>

        {problem && (
          <div className="error-banner" role="alert">
            <IconAlert className="error-banner-icon" />
            <span className="error-banner-text">{problem.message}</span>
            <button className="btn-ghost" type="button" onClick={problem.retry}>
              Try again
            </button>
          </div>
        )}

        <ScoreCard score={overview.score} streak={overview.streak} insight={overview.insight} />

                <QuickLog onLog={handleLog} />


        <section className="today-section" aria-labelledby="today-h">
        <h2 className="section-title" id="today-h">Today against your goals</h2>
        <div className="stat-grid">
          <StatCard
            label={METRIC_LABELS.walk}
            metric="walk"
            value={overview.today.walk || 0}
            unit="steps"
            goal={overview.goals.walk}
            accent="var(--c-walk)"
          />
          <StatCard
            label={METRIC_LABELS.water}
            metric="water"
            value={overview.today.water || 0}
            unit="ml"
            goal={overview.goals.water}
            accent="var(--c-water)"
          />
          <StatCard
            label={METRIC_LABELS.sleep}
            metric="sleep"
            value={overview.today.sleep || 0}
            unit="hrs"
            goal={overview.goals.sleep}
            accent="var(--c-sleep)"
          />
        </div>
        </section>

        <section className="chart-section">
          <h2 className="section-title">This week</h2>
          <div className="metric-tabs" role="group" aria-label="Metric to chart">
            {METRICS.map((m) => (
              <button
                key={m}
                className={`metric-tab t-${m} ${activeMetric === m ? "is-active" : ""}`}
                aria-pressed={activeMetric === m}
                onClick={() => setActiveMetric(m)}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
          <WeeklyChart metric={activeMetric} data={metricHistory} endDate={overview.as_of} />
        </section>

        <section className="recent-section">
          <h2 className="section-title">Recent entries</h2>
          <RecentEntries logs={recentLogs} onDelete={handleDelete} onEdit={handleEdit} />
        </section>
      </main>
    </div>
  );
}
