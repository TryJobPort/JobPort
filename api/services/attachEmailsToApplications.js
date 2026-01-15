// api/services/attachEmailsToApplications.js
//
// Attach inbound_emails -> applications + create application_events(email_attached)
// Only attaches emails that pass isJobSignalEmail (score >= JP_ATTACH_MIN and not marketing)
// Only promotes when score >= JP_PROMOTE_MIN

const db = require("../db");
const crypto = require("crypto");

const { isJobSignalEmail, scoreJobSignal, deriveAppFromEmail } = require("./jobSignalFilter");
const { promoteApplicationFromEmailSignal } = require("./promoteFromEmailSignal");

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

function getOrCreateApplicationFromEmail(userId, emailRow) {
  const uid = String(userId);
  const derived = deriveAppFromEmail(emailRow);

  const company = String(derived.company || "Unknown").trim() || "Unknown";
  const role = String(derived.role || "Role").trim() || "Role";
  const portal = String(derived.portal || "Email").trim() || "Email";

  // Dedupe by company+role (conservative)
  const existing = db.prepare(`
    SELECT id
    FROM applications
    WHERE user_id = ?
      AND lower(company) = lower(?)
      AND lower(role) = lower(?)
    ORDER BY datetime(updated_at) DESC
    LIMIT 1
  `).get(uid, company, role);

  if (existing?.id) return { applicationId: existing.id, created: false };

  const id = newId();
  db.prepare(`
    INSERT INTO applications (
      id, user_id, company, role, portal, status, url, is_demo, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, 'Applied', '', 0, ?, ?
    )
  `).run(id, uid, company, role, portal, nowIso(), nowIso());

  return { applicationId: id, created: true };
}

function insertEmailAttachedEvent({ userId, applicationId, emailRow, score, reasons }) {
  const payloadObj = {
    inbound_email_id: emailRow.id,
    from_email: emailRow.from_email || "",
    subject: emailRow.subject || "",
    received_at: emailRow.received_at || null,
    match_score: score,
    match_reasons: reasons || [],
  };

  db.prepare(`
    INSERT INTO application_events (
      id, user_id, application_id, event_type,
      prev_signal_mark, next_signal_mark, drift_detected,
      checked_at, created_at, payload, source
    ) VALUES (
      ?, ?, ?, 'email_attached',
      NULL, NULL, 0,
      NULL, ?, ?, ?
    )
  `).run(
    newId(),
    String(userId),
    String(applicationId),
    nowIso(),
    JSON.stringify(payloadObj),
    emailRow.source || "gmail"
  );
}

function markEmailAttached({ userId, emailId, applicationId, score, reasons }) {
  db.prepare(`
    UPDATE inbound_emails
    SET matched_application_id = ?,
        match_score = ?,
        match_reasons_json = ?,
        match_attached_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    String(applicationId),
    Number(score || 0),
    JSON.stringify(reasons || []),
    nowIso(),
    String(emailId),
    String(userId)
  );
}

async function attachInboundEmailsToApplications(userId, limit = 300) {
  const uid = String(userId);
  const ATTACH_MIN = Number(process.env.JP_ATTACH_MIN || 60);
  const PROMOTE_MIN = Number(process.env.JP_PROMOTE_MIN || 80);

  const emails = db.prepare(`
    SELECT id, user_id, source, from_email, subject, raw_body, received_at, match_score, match_reasons_json
    FROM inbound_emails
    WHERE user_id = ?
      AND (matched_application_id IS NULL OR matched_application_id = '')
    ORDER BY datetime(received_at) DESC
    LIMIT ?
  `).all(uid, Number(limit) || 300);

  let scanned = 0;
  let attached = 0;
  let skippedNonJob = 0;
  let skippedLowScore = 0;
  let promoted = 0;

  for (const e of emails) {
    scanned++;

            // Prefer stored match_score/match_reasons when present; otherwise compute.
    let s;
    if (e.match_score !== null && e.match_score !== undefined) {
      let reasons = [];
      try {
        reasons = e.match_reasons_json ? JSON.parse(e.match_reasons_json) : [];
      } catch (_) {}
      s = { score: Number(e.match_score) || 0, reasons };
    } else {
      s = scoreJobSignal(e);
    }

    const effectiveScore = Number(s.score || 0);

    // gate 1a: below threshold
    if (effectiveScore < ATTACH_MIN) {
      skippedLowScore++;
      continue;
    }

    // gate 1b: fails job-signal heuristics (marketing, etc.)
    if (!isJobSignalEmail(e)) {
      skippedNonJob++;
      continue;
    }


    const { applicationId } = getOrCreateApplicationFromEmail(uid, e);

    // idempotency: do not insert duplicate event for same inbound_email_id
    const already = db.prepare(`
      SELECT 1
      FROM application_events
      WHERE user_id = ?
        AND application_id = ?
        AND event_type = 'email_attached'
        AND json_extract(payload, '$.inbound_email_id') = ?
      LIMIT 1
    `).get(uid, applicationId, e.id);

    if (!already) {
      insertEmailAttachedEvent({
        userId: uid,
        applicationId,
        emailRow: e,
        score: effectiveScore,
        reasons: s.reasons,
      });
      attached++;
    }

    markEmailAttached({
      userId: uid,
      emailId: e.id,
      applicationId,
      score: effectiveScore,
      reasons: s.reasons,
    });

    // promotion gated by PROMOTE_MIN
    if (effectiveScore >= PROMOTE_MIN) {
      try {
        const r = promoteApplicationFromEmailSignal(uid, applicationId, e);
        if (r?.changed) promoted++;
      } catch (_) {}
    }
  }

  return { ok: true, scanned, attached, skippedNonJob, skippedLowScore, promoted, ATTACH_MIN, PROMOTE_MIN };
}

module.exports = { attachInboundEmailsToApplications };
