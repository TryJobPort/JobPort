// api/services/inboxScan.js
const db = require("../db");

/**
 * Minimal initial scan hook.
 * Phase 20.2 only seeds the pipeline.
 * Full pagination / history comes later.
 */
async function enqueueInitialInboxScan({ userId, provider }) {
  // For now we simply mark the user as "ready to scan".
  // Your existing background scanner can pick this up.
  db.prepare(
    `
    INSERT OR IGNORE INTO application_events (
      id,
      application_id,
      event_type,
      source,
      created_at
    ) VALUES (?, NULL, 'oauth_connected', ?, datetime('now'))
  `
  ).run(
    `oauth-${userId}`,
    provider
  );

  console.log(`[inbox] OAuth connected for user=${userId}`);
}

module.exports = {
  enqueueInitialInboxScan,
};
