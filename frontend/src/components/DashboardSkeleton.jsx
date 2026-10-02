import Sidebar from "./Sidebar.jsx";

// Layout-shaped placeholder shown while the dashboard loads (purely visual).
export default function DashboardSkeleton() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main" aria-busy="true">
        <p className="sr-only" role="status">Loading your dashboard…</p>
        <div className="sk sk-title" />
        <div className="sk sk-sub" />
        <div className="sk sk-hero" />
        <div className="sk sk-log" />
        <div className="sk sk-stats" />
        <div className="sk sk-chart" />
      </main>
    </div>
  );
}
