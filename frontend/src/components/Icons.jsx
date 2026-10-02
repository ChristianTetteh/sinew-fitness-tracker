// Small inline icon set (24px grid, currentColor). All decorative: callers supply the accessible name.
const base = { viewBox: "0 0 24 24", width: 20, height: 20, "aria-hidden": "true", focusable: "false" };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };

export function IconToday(props) {
  return (
    <svg {...base} {...props}>
      <path {...stroke} d="M4 12.5 12 5l8 7.5M6.5 11v8h11v-8" />
    </svg>
  );
}
export function IconGoals(props) {
  return (
    <svg {...base} {...props}>
      <circle {...stroke} cx="12" cy="12" r="8" />
      <circle {...stroke} cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
export function IconSun(props) {
  return (
    <svg {...base} {...props}>
      <circle {...stroke} cx="12" cy="12" r="4" />
      <path {...stroke} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  );
}
export function IconMoon(props) {
  return (
    <svg {...base} {...props}>
      <path {...stroke} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  );
}
export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path {...stroke} d="M10 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5H10M15 8l4 4-4 4M19 12H9.5" />
    </svg>
  );
}
export function IconFlame(props) {
  return (
    <svg {...base} {...props}>
      <path
        fill="currentColor"
        d="M12.6 2.5c.5 3-1.4 4.6-3 6.4C7.9 10.8 6.5 12.7 6.5 15.200A5.5 5.5 0 0 0 12 20.700a5.5 5.5 0 0 0 5.5-5.500c0-2.4-1.2-3.9-2.1-5.1-.3 1.2-1 2-1.9 2.3.6-3.4-.2-7.4-.9-9.900Z"
      />
    </svg>
  );
}
export function IconCheck(props) {
  return (
    <svg {...base} {...props}>
      <path {...stroke} strokeWidth="2.4" d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
export function IconAlert(props) {
  return (
    <svg {...base} {...props}>
      <path {...stroke} d="M12 4 3 19.500h18L12 4ZM12 10v4.500M12 17.200v.1" />
    </svg>
  );
}
export function IconLog(props) {
  return (
    <svg {...base} {...props}>
      <path {...stroke} d="M12 5v14M5 12h14" />
    </svg>
  );
}
export function MetricIcon({ metric, size = 18 }) {
  const p = { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": "true", focusable: "false" };
  if (metric === "walk")
    return (
      <svg {...p}>
        <path fill="currentColor" d="M9 3.500a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm2.2 6.4-3.6 1c-.8.2-1.3.9-1.3 1.700v4.400a1 1 0 0 0 2 0v-3.400l1.1-.3-.5 3.1-2.4 3.200a1 1 0 0 0 1.6 1.200l2.4-3.2.9-3 .9 1.900v4.200a1 1 0 0 0 2 0v-4.400c0-.2 0-.4-.1-.6l-1.6-3.500c-.3-.7-1-1.1-1.7-1Z" />
      </svg>
    );
  if (metric === "water")
    return (
      <svg {...p}>
        <path fill="currentColor" d="M12 2.500s6.5 7.2 6.5 12a6.5 6.5 0 1 1-13 0c0-4.8 6.5-12 6.5-12Z" />
      </svg>
    );
  return (
    <svg {...p}>
      <path fill="currentColor" d="M20.5 15.300a8.5 8.5 0 1 1-9.8-12 7 7 0 1 0 9.8 12Z" />
    </svg>
  );
}
