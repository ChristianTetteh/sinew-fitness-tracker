import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't log in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <aside className="auth-panel" aria-hidden="true">
        <img src="/logo-mark.png" alt="" width="72" height="72" />
        <p className="auth-panel-line">Track effort.<br />Build strength.</p>
        <p className="auth-panel-sub">Steps, water and sleep against goals you set, scored every day.</p>
      </aside>
      <div className="auth-card">
        <div className="auth-mark">
          <img src="/logo-mark.png" alt="" width="34" height="34" />
          SINEW
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-tagline">Log in to see today's effort.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          New to Sinew? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
