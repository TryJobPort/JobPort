// api/scripts/backfillRoles24_2.js
//
// Phase 24.2 — One-time role cleanup backfill
// Usage:
//   cd api
//   node scripts/backfillRoles24_2.js
//
// What it does:
// - Scans existing applications
// - If role looks subject-y, tries to derive a clean job title
// - Updates applications.role + updated_at

const db = require("../db");
const { normalizeRoleFromExisting } = require("../services/roleNormalize");

const nowIso = () => new Date().toISOString();

function shouldConsider(role) {
  const r = String(role || "").toLowerCase();
  if (!r) return true;
  if (r.length > 60) return true;
  if (r.startsWith("re:")) return true;
  if (r.startsWith("fw:")) return true;
  if (r.startsWith("fwd:")) return true;
  if (r.includes("interview")) return true;
  if (r.includes("your application")) return true;
  if (r.includes("application received")) return true;
  if (r.includes("thank you for applying")) return true;
  if (r.includes("next steps")) return true;
  return false;
}

const rows = db
  .prepare(
    `SELECT id, user_id, company, role
     FROM applications
     WHERE is_demo = 0
     ORDER BY updated_at DESC`
  )
  .all();

const upd = db.prepare(`UPDATE applications SET role = ?, updated_at = ? WHERE id = ?`);

let scanned = 0;
let updated = 0;
let unchanged = 0;
let skipped = 0;

for (const r of rows) {
  scanned++;
  if (!shouldConsider(r.role)) {
    skipped++;
    continue;
  }

  const next = normalizeRoleFromExisting({ role: r.role, company: r.company });
  if (!next) {
    unchanged++;
    continue;
  }

  if (String(next).trim() === String(r.role || "").trim()) {
    unchanged++;
    continue;
  }

  upd.run(next, nowIso(), r.id);
  updated++;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      phase: "24.2",
      scanned,
      updated,
      unchanged,
      skipped,
    },
    null,
    2
  )
);
