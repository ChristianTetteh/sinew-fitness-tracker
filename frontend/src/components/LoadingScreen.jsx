// A small on-brand loading screen: a stylized arm curling a dumbbell.
// Uses native SVG SMIL animation (animateTransform/animate) rather than CSS
// transforms, so the rotation pivot is exact and there's no transform-origin
// ambiguity across browsers.
export default function LoadingScreen({ label = "Loading Sinew…" }) {
  return (
    <div className="page-loading">
      <svg className="loader-rig" viewBox="0 0 160 170" width="130" height="138" aria-hidden="true">
        {/* shoulder + upper arm (fixed) */}
        <line x1="50" y1="30" x2="50" y2="82" stroke="var(--muted)" strokeWidth="11" strokeLinecap="round" />
        <circle cx="50" cy="30" r="10" fill="var(--muted)" />

        {/* bicep bulge, pulses as the curl peaks */}
        <ellipse cx="50" cy="56" rx="13" ry="20" fill="var(--ember)" opacity="0.9">
          <animate attributeName="rx" values="13;19;13" dur="1.3s" repeatCount="indefinite" />
          <animate attributeName="ry" values="20;24;20" dur="1.3s" repeatCount="indefinite" />
        </ellipse>

        {/* elbow pivot */}
        <circle cx="50" cy="82" r="8" fill="var(--ember)" />

        {/* forearm + dumbbell, rotates around the elbow */}
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 50 82; -128 50 82; 0 50 82"
            dur="1.3s"
            repeatCount="indefinite"
          />
          <line x1="50" y1="82" x2="50" y2="136" stroke="var(--text)" strokeWidth="10" strokeLinecap="round" />
          <g transform="translate(50,136)">
            <rect x="-20" y="-5" width="40" height="10" rx="5" fill="var(--text)" />
            <circle cx="-17" cy="0" r="12" fill="var(--teal)" />
            <circle cx="17" cy="0" r="12" fill="var(--teal)" />
          </g>
        </g>
      </svg>
      <p className="loader-text">{label}</p>
    </div>
  );
}
