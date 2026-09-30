import { useEffect, useState } from "react";

const SEEN_KEY = "sinew_intro_seen";

// A one-time animated entrance shown the first time Sinew ever opens in a
// browser (tracked via localStorage, not per-session) — the mark scales and
// glows in, the wordmark follows, then the whole overlay dissolves into the
// real app. Respects prefers-reduced-motion by skipping straight through.
export default function SplashIntro({ onDone }) {
  const [phase, setPhase] = useState("mark"); // mark -> word -> hold -> out -> gone

  useEffect(() => {
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) {
      finish();
      return;
    }

    const timers = [
      setTimeout(() => setPhase("word"), 550),
      setTimeout(() => setPhase("hold"), 1150),
      setTimeout(() => setPhase("out"), 1950),
      setTimeout(finish, 2500),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore — worst case the intro replays next time
    }
    setPhase("gone");
    onDone?.();
  }

  if (phase === "gone") return null;

  return (
    <div className={`splash ${phase === "out" ? "splash-out" : ""}`}>
      <div className="splash-glow" aria-hidden="true" />
      <img
        src="/logo-mark.png"
        alt=""
        width="120"
        height="120"
        className="splash-mark"
      />
      <div className={`splash-word display ${phase !== "mark" ? "splash-word-in" : ""}`}>
        SINEW
      </div>
    </div>
  );
}

export function shouldShowIntro() {
  try {
    return !localStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}
