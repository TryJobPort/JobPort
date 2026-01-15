// api/scripts/resetUserPipeline.js
//
// One-time dev reset for a single user:
// - deletes non-demo applications + events
// - clears inbound_emails matching markers so they can be reprocessed
//
// Run from api/:
//   node scripts/resetUserPipeline.js 5e7d6e07-94b6-495e-ac6e-66bb7312d078

const db = require("../db");

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/resetUserPipeline.js <USER_ID>");
  process.exit(1);
}

const uid = String(userId);

// delete events first
const ev = db.prepare(`DELETE FROM application_events WHERE user_id = ?`).run(uid);

// delete applications (keep demos if you want; here we keep is_demo=0 only)
const apps = db
  .prepare(`DELETE FROM applications WHERE user_id = ? AND (is_demo = 0 OR is_demo IS NULL)`)
  .run(uid);

// clear inbound email processed markers so attach can re-run with new rules
const emails = db
  .prepare(
    `UPDATE inbound_emails
     SET matched_application_id = NULL,
         match_score = NULL,
         match_reasons_json = NULL,
         match_attached_at = NULL
     WHERE user_id = ? AND source = 'gmail'`
  )
  .run(uid);

console.log(
  JSON.stringify(
    { ok: true, userId: uid, deleted_events: ev.changes, deleted_apps: apps.changes, reset_emails: emails.changes },
    null,
    2
  )
);
