import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { IconToday, IconGoals, IconSun, IconMoon, IconLogout } from "./Icons.jsx";

// Desktop/tablet: a left rail. Phone: a slim top bar (brand, theme, log out) plus a
// bottom tab bar, so navigation sits under the thumb instead of behind a hamburger.
export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toLight = theme === "dark";
  const themeLabel = toLight ? "Switch to light mode" : "Switch to dark mode";
  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  const linkClass = ({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`;

  return (
    <>
      <header className="mobile-topbar">
        <span className="brand">
          <img src="/logo-mark.png" alt="" width="26" height="26" />
          <span className="brand-word">SINEW</span>
        </span>
        <div className="topbar-actions">
          <button className="icon-btn" type="button" onClick={toggleTheme} aria-label={themeLabel}>
            {toLight ? <IconSun /> : <IconMoon />}
          </button>
          <button className="icon-btn" type="button" onClick={logout} aria-label="Log out">
            <IconLogout />
          </button>
        </div>
      </header>

      <aside className="rail">
        <span className="brand">
          <img src="/logo-mark.png" alt="" width="30" height="30" />
          <span className="brand-word">SINEW</span>
        </span>

        <nav className="rail-nav" aria-label="Main">
          <NavLink to="/" end className={linkClass}>
            <IconToday />
            Dashboard
          </NavLink>
          <NavLink to="/goals" className={linkClass}>
            <IconGoals />
            Goals
          </NavLink>
        </nav>

        <div className="rail-foot">
          <button className="rail-theme" type="button" onClick={toggleTheme}>
            {toLight ? <IconSun /> : <IconMoon />}
            {toLight ? "Light mode" : "Dark mode"}
          </button>
          <div className="rail-user">
            <span className="avatar" aria-hidden="true">{initial}</span>
            <div className="rail-user-text">
              <div className="rail-user-name">{user?.name}</div>
              <div className="rail-user-email">{user?.email}</div>
            </div>
          </div>
          <button className="btn-ghost rail-logout" type="button" onClick={logout}>
            <IconLogout width="18" height="18" />
            Log out
          </button>
        </div>
      </aside>

      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end className={linkClass}>
          <IconToday width="22" height="22" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/goals" className={linkClass}>
          <IconGoals width="22" height="22" />
          <span>Goals</span>
        </NavLink>
      </nav>
    </>
  );
}
