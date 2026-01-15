// api/routes/ingestEmail.js

const express = require("express");
const crypto = require("crypto");

const db = require("../db");
const { normalizeEmail } = require("../utils/normalizeEmail");
const extractInterviewSignal = require("../utils/extractInterviewSignal");
const {
  matchEmailToApplications,
  getTopCandidate,
  confidenceForScore,
} = require("../utils/matchEmailToApplications");
const {
  maybeApplyEmailStatusInference,
} = require("../services/maybeApplyEmailStatusInference");

const router = express.Router();

// ------------------------------------------------------------
// POST /ingest/email
// ------------------------------------------------------------
router.post("/email", (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }

  const {
    source = "unknown",
    from,
    to,
    subject,
    body,
    receivedAt,
  } = req.body || {};

  if (!body || !receivedAt) {
    return res.status(400).json({
      ok: false,
      error: "body and receivedAt are required",
    });
  }

  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO inbound_emails (
      id,
      user_id,
      source,
      from_email,
      to_email,
      subject,
      raw_body,
      received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user.id,
    String(source),
    from ? String(from) : null,
    to ? String(to) : null,
    subject ? String(subject) : null,
    typeof body === "string" ? body : JSON.stringify(body),
    String(receivedAt)
  );

  res.json({ ok: true, id });
});

// ------------------------------------------------------------
// POST /ingest/email/:id/normalize
// ------------------------------------------------------------
router.post("/email/:id/normalize", (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }

  const row = db.prepare(`
    SELECT *
    FROM inbound_emails
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.user.id);

  if (!row) {
    return res.status(404).json({ ok: false, error: "not found" });
  }

  const normalized = normalizeEmail(row);

  db.prepare(`
    UPDATE inbound_emails
    SET
      normalized_from = ?,
      normalized_to = ?,
      normalized_subject = ?,
      text_body = ?,
      html_body = ?,
      processed_at = ?
    WHERE id = ?
  `).run(
    normalized.normalized_from,
    normalized.normalized_to,
    normalized.normalized_subject,
    normalized.text_body,
    normalized.html_body,
    new Date().toISOString(),
    row.id
  );

  res.json({ ok: true });
});

// ------------------------------------------------------------
// GET /ingest/email/:id/candidates
// ------------------------------------------------------------
router.get("/email/:id/candidates", (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }

  const email = db.prepare(`
    SELECT *
    FROM inbound_emails
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.user.id);

  if (!email) {
    return res.status(404).json({ ok: false, error: "not found" });
  }

  const applications = db.prepare(`
    SELECT id, company, role, portal
    FROM applications
    WHERE user_id = ?
  `).all(req.user.id);

  const candidates = matchEmailToApplications({
    email,
    applications,
    limit: 5,
  });

  res.json({ ok: true, candidates });
});

// ------------------------------------------------------------
// GET /ingest/email/:id/preview
// ------------------------------------------------------------
router.get("/email/:id/preview", (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }

  const email = db.prepare(`
    SELECT *
    FROM inbound_emails
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.user.id);

  if (!email) {
    return res.status(404).json({ ok: false, error: "not found" });
  }

  const applications = db.prepare(`
    SELECT id, company, role, portal
    FROM applications
    WHERE user_id = ?
  `).all(req.user.id);

  const candidates = matchEmailToApplications({
    email,
    applications,
    limit: 5,
  });

  const top = getTopCandidate(candidates);
  const confidence = confidenceForScore(top?.score || 0);

  res.json({
    ok: true,
    confidence,
    topCandidate: top || null,
    candidates,
  });
});

// ------------------------------------------------------------
// POST /ingest/email/:id/auto-attach
// ------------------------------------------------------------
router.post("/email/:id/auto-attach", (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }

  const email = db.prepare(`
    SELECT *
    FROM inbound_emails
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.user.id);

  if (!email) {
    return res.status(404).json({ ok: false, error: "not found" });
  }

  const applications = db.prepare(`
    SELECT id, company, role, portal
    FROM applications
    WHERE user_id = ?
  `).all(req.user.id);

  const candidates = matchEmailToApplications({
    email,
    applications,
    limit: 5,
  });

  const top = getTopCandidate(candidates);
  const confidence = confidenceForScore(top?.score || 0);

  if (confidence !== "high" || !top?.applicationId) {
    return res.json({
      ok: true,
      attached: false,
      confidence,
      topCandidate: top || null,
      candidates,
    });
  }

  // Attach email to application
  db.prepare(`
    UPDATE inbound_emails
    SET
      matched_application_id = ?,
      match_confidence = ?,
      match_score = ?,
      match_reasons_json = ?,
      match_attached_at = ?
    WHERE id = ?
      AND user_id = ?
  `).run(
    top.applicationId,
    confidence,
    top.score || 0,
    JSON.stringify(top.reasons || []),
    new Date().toISOString(),
    email.id,
    req.user.id
  );

  // Apply status inference
  const statusInference = maybeApplyEmailStatusInference({
    db,
    email,
    applicationId: top.applicationId,
    userId: req.user.id,
  });

  // ------------------------------------------------------------
  // 18.5.3 — Apply interview signal when status becomes INTERVIEW
  // ------------------------------------------------------------
  if (
    statusInference?.applied === true &&
    statusInference?.next_status === "Interview"
  ) {
    const interview = extractInterviewSignal(email);

    if (interview?.hasInterview) {
      db.prepare(`
        UPDATE applications
        SET
          next_interview_at = ?,
          next_interview_source = 'email',
          next_interview_link = ?,
          next_interview_email_id = ?
        WHERE id = ?
          AND user_id = ?
      `).run(
        interview.interviewAt,
        interview.meetingLink,
        email.id,
        top.applicationId,
        req.user.id
      );
    }
  }

  res.json({
    ok: true,
    attached: true,
    confidence,
    matched_application_id: top.applicationId,
    match_score: top.score || 0,
    match_reasons: top.reasons || [],
    status_inference: statusInference || null,
  });
});

module.exports = router;
