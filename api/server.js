// api/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const db = require("./db");
const { normalizeJobApplicationStatus } = require("./lib/status");
const { scanJobApplication } = require("./services/scanJobApplication");
const { startBackgroundScanner } = require("./background/backgroundScanner");

const app = express();

// CORS + JSON
app.use(cors());
app.options("*", cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

function requireUser(req, res) {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    res.status(401).json({ ok: false, error: "Missing x-user-id" });
    return null;
  }
  return String(userId);
}

/**
 * Applications list (for the web UI)
 */
app.get("/applications", (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const rows = db
    .prepare(
      `SELECT
         id, user_id,
         company, role, portal, status, url,
         is_demo,
         last_checked_at,
         last_bearing_at,
         baseline_established_at,
         last_drift_detected_at,
         created_at, updated_at,
         alerts_cleared_at
       FROM applications
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .all(userId);

  res.json({ ok: true, applications: rows });
});

/**
 * Create a job application
 * Free plan: 1 tracked job application
 */
app.post("/applications", (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { company, role, portal, status, url } = req.body || {};

    const clean = (v) => (typeof v === "string" ? v.trim() : "");
    const companyC = clean(company);
    const roleC = clean(role);
    const portalC = clean(portal);
    const statusC = normalizeJobApplicationStatus(status);
    const urlC = clean(url);

    // Required fields (match your UI intent)
    if (!companyC || !roleC || !urlC) {
      return res.status(400).json({
        ok: false,
        error: "company, role, and url are required",
      });
    }

    // Free limit: 1 tracked job application
    const existingCount = db
      .prepare(`SELECT COUNT(1) AS c FROM applications WHERE user_id = ?`)
      .get(userId)?.c;

    if (Number(existingCount || 0) >= 3) {
      return res.status(403).json({
        ok: false,
        code: "FREE_LIMIT_REACHED",
        error: "Free plan supports tracking 1 job application. Upgrade to track more.",
      });
    }

    const id = crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex");

    const nowIso = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO applications (
        id, user_id, company, role, portal, status, url, is_demo, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      `
    ).run(
      id,
      userId,
      companyC,
      roleC,
      portalC || null,
      statusC || "Applied",
      urlC,
      nowIso,
      nowIso
    );

    const created = db
      .prepare(`SELECT * FROM applications WHERE id = ? AND user_id = ?`)
      .get(id, userId);

    return res.status(201).json({ ok: true, application: created });
  } catch (e) {
    console.error("[api] POST /applications error", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

/**
 * Manual scan (thin): delegates to scan service.
 */
app.post("/applications/:id/take-bearing", async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const result = await scanJobApplication({
      applicationId: req.params.id,
      userId,
      source: "manual",
    });

    res.json(result);
  } catch (err) {
    res
      .status(err?.statusCode || 500)
      .json({ ok: false, error: err?.message || "Scan failed" });
  }
});
app.post("/bootstrap/demo", (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const { scanJobApplication } = require("./services/scanJobApplication");

  const existing = db
    .prepare(`SELECT COUNT(1) AS c FROM applications WHERE user_id = ?`)
    .get(userId)?.c;

  if (existing > 0) {
    return res.json({ ok: true, skipped: true });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO applications (
      id, user_id, company, role, portal, status, url, is_demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    "Acme Corp",
    "Product Manager",
    "Greenhouse",
    "Applied",
    "https://job-boards.greenhouse.io/greenhouse/jobs/4011365007",
    1,        // ← THIS IS THE MISSING PIECE
    now,
    now
  );
  db.prepare(
  `INSERT INTO application_events (
    id, application_id, user_id,
    event_type, payload, source,
    prev_status_signal, next_status_signal, status_changed,
    drift_detected, prev_signal_mark, next_signal_mark,
    checked_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(
  crypto.randomUUID(),
  id,
  userId,
  "status_signal_changed",
  JSON.stringify({
    source: "bootstrap",
    note: "Demo alert",
    prev_status_signal: "Applied",
    next_status_signal: "Under Review",
  }),
  "bootstrap",
  "Applied",
  "Under Review",
  1,
  0,
  null,
  null,
  now,
  now
);
// Auto-scan demo once so Alerts is populated
scanJobApplication({
  applicationId: id,
  userId,
  source: "bootstrap",
}).catch((err) => {
  console.error("[bootstrap] demo auto-scan failed", err);
});

res.json({ ok: true, created: true });

});
/**
 * Clear alerts (suppresses prior events permanently)
 */
app.post("/applications/:id/clear-alerts", (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE applications
     SET alerts_cleared_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(nowIso, nowIso, req.params.id, userId);

  res.json({ ok: true, clearedAt: nowIso });
});

/**
 * Alerts inbox
 * - latest qualifying event per job application
 * - qualifying = status_changed OR drift_detected
 * - respect alerts_cleared_at (events before clear are suppressed)
 */
app.get("/alerts", (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const rows = db
    .prepare(
      `SELECT
         e.id AS event_id,
         e.application_id,
         e.event_type,
         e.status_changed,
         e.drift_detected,
         e.prev_status_signal,
         e.next_status_signal,
         e.checked_at,
         e.created_at,
         e.source,
         a.company, a.role, a.portal, a.status, a.url,
         a.is_demo,
         a.alerts_cleared_at
       FROM application_events e
       JOIN applications a ON a.id = e.application_id
       WHERE e.user_id = ?
         AND a.user_id = ?
         AND (e.status_changed = 1 OR e.drift_detected = 1)
         AND (a.alerts_cleared_at IS NULL OR e.created_at > a.alerts_cleared_at)
         AND e.created_at = (
           SELECT MAX(e2.created_at)
           FROM application_events e2
           WHERE e2.application_id = e.application_id
             AND e2.user_id = e.user_id
             AND (e2.status_changed = 1 OR e2.drift_detected = 1)
             AND (a.alerts_cleared_at IS NULL OR e2.created_at > a.alerts_cleared_at)
         )
       ORDER BY e.created_at DESC
       LIMIT 200`
    )
    .all(userId, userId);

  const alerts = rows.map((r) => {
  const lastCheckedAt = db
  .prepare(
    `SELECT MAX(last_checked_at) AS ts
     FROM applications
     WHERE user_id = ?`
  )
  .get(userId)?.ts || null;

    let alert = null;

    if (r.status_changed) {
      alert = {
        type: "JOB_APPLICATION_STATUS_CHANGED",
        severity: "HIGH",
        title: "Job application status likely changed",
        message: `We detected a likely status change: ${
          r.prev_status_signal || "UNKNOWN"
        } → ${r.next_status_signal || "UNKNOWN"}.`,
        meta: {
          prevStatus: r.prev_status_signal || "UNKNOWN",
          nextStatus: r.next_status_signal || "UNKNOWN",
        },
        primaryAction: { 
          label: "View history",
          href: `/job-applications/${r.application_id}`,
        },
      secondaryAction: { label: "Open job application page", href: r.url },
      };
    } else if (r.drift_detected) {
      alert = {
        type: "JOB_APPLICATION_PAGE_CHANGED",
        severity: "HIGH",
        title: "Change detected on this job application page",
        message:
          "This job application page changed since your last scan. Review the posting to confirm whether the job application status changed.",
        primaryAction: {
          label: "View history",
          href: `/job-applications/${r.application_id}`,
        },
        secondaryAction: { label: "Open job application page", href: r.url },
      };
    }

    return {
      id: r.event_id,
      eventId: r.event_id,
      applicationId: r.application_id,
      company: r.company,
      role: r.role,
      portal: r.portal,
      status: r.status,
      url: r.url,
      is_demo: r.is_demo,
      checkedAt: r.checked_at || r.created_at,
      createdAt: r.created_at,
      source: r.source,
      alert,
    };
  });

  res.json({
  ok: true,
  alerts,
  alerts_meta: {
    last_checked_at: lastCheckedAt,
  },
});
});
/**
 * Remove demo job application (and its events)
 */
app.delete("/applications/:id/remove-demo", (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { id } = req.params;

  // Ensure this is a demo application
  const appRow = db
    .prepare(
      `SELECT id FROM applications
       WHERE id = ? AND user_id = ? AND is_demo = 1`
    )
    .get(id, userId);

  if (!appRow) {
    return res.status(404).json({
      ok: false,
      error: "Demo job application not found",
    });
  }

  // Delete events first
  db.prepare(
    `DELETE FROM application_events
     WHERE application_id = ? AND user_id = ?`
  ).run(id, userId);

  // Delete application
  db.prepare(
    `DELETE FROM applications
     WHERE id = ? AND user_id = ? AND is_demo = 1`
  ).run(id, userId);

  res.json({ ok: true, removed: true });
});

// Start server + background scans
const server = app.listen(PORT, () => {
  console.log("[api] listening on http://localhost:" + PORT);

  const enabled =
    String(process.env.ENABLE_BACKGROUND_SCANS || "").toLowerCase() === "true";
  const tickMs = Number(process.env.BG_SCAN_TICK_MS || 60000);
  const batchSize = Number(process.env.BG_SCAN_BATCH_SIZE || 5);
  const concurrency = Number(process.env.BG_SCAN_CONCURRENCY || 2);

  startBackgroundScanner({ enabled, tickMs, batchSize, concurrency });
});

server.on("error", function (err) {
  console.log("[api] server error:", err && err.message ? err.message : err);
});