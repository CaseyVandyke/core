// "2026-07-11" -> "July 11, 2026" (parsed as local time, not UTC)
export function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// "2026-07-11" -> "Jul 11" (compact, for chart axes and tooltips)
export function shortDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
