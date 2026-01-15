// api/services/getApplicationExplanation.js
const db = require("../db");

function tryParse(json) {
  try {
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

/**
 * getApplicationExplanation(userId, applicationId)
 * Reads from application_events (NOT events).
 * Looks for most recent status-change style event with payload.
 */
function getApplicationExplanation(userId, applicationId) {
  const app = db
    .prepare(`SELECT id, company, role, status FROM applications WHERE id=? AND user_id=? LIMIT 1`)
    .get(String(applicationId), String(userId));

  if (!app) return { ok: false, code: "NOT_FOUND" };

  // Prefer explicit status events, then fall back to any event with status_changed=1 in payload.
  const ev = db
    .prepare(
      `
      SELECT id, event_type, created_at, payload
      FROM application_events
      WHERE user_id = ?
        AND application_id = ?
        AND (
          event_type IN ('email_status_promoted','status_signal_changed','status_changed')
          OR json_extract(payload, '$.statusChanged') = 1
          OR json_extract(payload, '$.status_changed') = 1
          OR json_extract(payload, '$.nextStatus') IS NOT NULL
          OR json_extract(payload, '$.next_status') IS NOT NULL
          OR json_extract(payload, '$.next_status_signal') IS NOT NULL
        )
      ORDER BY datetime(created_at) DESC
      LIMIT 1
      `
    )
    .get(String(userId), String(applicationId));

  if (!ev) {
    return { ok: true, application: app, explanation: null };
  }

  const payload = tryParse(ev.payload);

  // Normalize fields across our two producers (scan + email promotion)
  const prevStatus =
    payload.prevStatus ||
    payload.prev_status ||
    payload.prev_status_signal ||
    payload.prev_statusSignal ||
    null;

  const nextStatus =
    payload.nextStatus ||
    payload.next_status ||
    payload.next_status_signal ||
    payload.next_statusSignal ||
    app.status;

  const reason =
    payload.reason ||
    payload.statusReason ||
    payload.status_reason ||
    (payload.inferred?.reason ? payload.inferred.reason : null) ||
    null;

  const emailId =
    payload.emailId ||
    payload.email_id ||
    payload.inbound_email_id ||
    payload.next_interview_email_id ||
    null;

  let email = null;
  if (emailId) {
    email = db
      .prepare(
        `
        SELECT id, subject, from_email, from_name, received_at
        FROM inbound_emails
        WHERE id = ? AND user_id = ?
        LIMIT 1
        `
      )
      .get(String(emailId), String(userId));
  }

  const signal =
    payload.signal ||
    payload.detectedSignal ||
    payload.detected_signal ||
    payload.inferred ||
    payload.inferred_raw_signal ||
    null;

  return {
    ok: true,
    application: app,
    explanation: {
      eventId: ev.id,
      occurredAt: ev.created_at,
      eventType: ev.event_type,
      prevStatus,
      nextStatus,
      signal,
      reason,
      email: email
        ? {
            id: email.id,
            subject: email.subject,
            from: email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email,
            receivedAt: email.received_at,
          }
        : null,
    },
  };
}

module.exports = { getApplicationExplanation };
