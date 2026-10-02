// logged_at comes back from Postgres as an ISO date string like "2026-09-25".
// These helpers turn that into human-friendly labels without pulling in a date library.

export function toLocalDate(isoDateStr) {
  const [year, month, day] = isoDateStr.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayLabel(isoDateStr) {
  const date = toLocalDate(isoDateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function fullDateLabel(date = new Date()) {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// The `count` calendar days ending at `endDateStr` ("YYYY-MM-DD"), oldest first, as
// { key: "YYYY-MM-DD", date: Date } with each Date at local midnight.
export function lastNDays(count, endDateStr) {
  const end = endDateStr ? toLocalDate(endDateStr) : toLocalDate(toIsoDate(new Date()));
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (count - 1 - i));
    return { key: toIsoDate(date), date };
  });
}

function toIsoDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
