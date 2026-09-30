import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile-only top bar with hamburger toggle */}
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setOpen(true)} aria-label="Open menu">
          <span />
          <span />
          <span />
        </button>
        <span className="mobile-mark">
          <img src="/logo-mark.png" alt="" width="24" height="24" />
          SINEW
        </span>
      </div>

      {open && <div className="rail-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`rail ${open ? "is-open" : ""}`}>
        <div className="rail-top">
          <div className="rail-mark">
            <img src="/logo-mark.png" alt="" width="28" height="28" />
            SINEW
          </div>
          <button className="rail-close" onClick={() => setOpen(false)} aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav className="rail-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `rail-link ${isActive ? "is-active" : ""}`}
            onClick={() => setOpen(false)}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/goals"
            className={({ isActive }) => `rail-link ${isActive ? "is-active" : ""}`}
            onClick={() => setOpen(false)}
          >
            Goals
          </NavLink>
        </nav>

        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === "dark" ? "☀ Light mode" : "🌙 Dark mode"}
        </button>

        <div className="rail-user">
          <div className="rail-user-name">{user?.name}</div>
          <div className="rail-user-email">{user?.email}</div>
        </div>
        <button className="btn-ghost" onClick={logout}>
          Log out
        </button>
      </aside>
    </>
  );
}
