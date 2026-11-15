// Pakistan time helpers. The database stores timestamps in UTC (with a "+00"
// suffix), so "today" must be worked out in Asia/Karachi, not UTC —
// otherwise sales made between 12:00am and 5:00am PKT count as yesterday.
export const PK_TZ = "Asia/Karachi";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: PK_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function parseTs(v) {
  let d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) d = new Date(String(v || "").replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  return d;
}

// "YYYY-MM-DD" of a timestamp (or of right now) in Pakistan time.
export function pkDay(v = new Date()) {
  const d = parseTs(v);
  return isNaN(d) ? String(v || "").slice(0, 10) : dayFmt.format(d);
}

// The last `n` Pakistan calendar days, oldest first, ending today.
export function lastPkDays(n) {
  const [y, m, d] = pkDay().split("-").map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  return out;
}

// Safe lower bound for a text-timestamp column (UTC date a few days back).
export function utcCutoff(daysBack) {
  return new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
}
