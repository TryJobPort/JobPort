const db = require("../db");

function computeCadenceMinutes(status) {
  const s = String(status || "").toUpperCase();
  if (["REJECTED", "CLOSED"].includes(s)) return 24 * 60; // or return null to stop
  if (s === "INTERVIEW") return 240;        // 4h
  if (s === "UNDER_REVIEW") return 60;      // 1h
  if (s === "APPLIED") return 60;           // 1h
  return 180;                                // default 3h
}

function computeNextScanAt({ status, lastCheckedAtIso }) {
  const cadenceMin = computeCadenceMinutes(status);
  if (!cadenceMin) return null;

  const nowMs = Date.now();
  const baseMs = lastCheckedAtIso ? new Date(lastCheckedAtIso).getTime() : nowMs;
  const nextMs = baseMs + cadenceMin * 60_000;

  return new Date(Math.max(nextMs, nowMs + 60_000)).toISOString();
}

const rows = db.prepare(`
  SELECT id, status, last_checked_at
  FROM applications
  WHERE next_scan_at IS NULL
`).all();

const upd = db.prepare(`UPDATE applications SET next_scan_at = ? WHERE id = ?`);

db.transaction(() => {
  for (const r of rows) {
    const next = computeNextScanAt({ status: r.status, lastCheckedAtIso: r.last_checked_at });
    upd.run(next, r.id);
  }
})();

console.log(`Backfilled next_scan_at for ${rows.length} applications`);
