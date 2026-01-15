// api/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const { isJobSignalEmail, deriveAppFromEmail } = require("./services/jobSignalFilter");
const { getInsightsPreview } = require("./services/getInsightsPreview");

// INSIGHTS PREVIEW (Pro card teasers)
// - If unauthenticated, return demo preview (keeps /dashboard usable as a demo)
app.get("/insights/preview", (req, res) => {
  const userId = req.user?.id ? String(req.user.id) : getDemoUserId();
  const demo = !req.user?.id;

  const result = getInsightsPreview(userId);
  return res.json({ ...result, demo });
});

const db = require("./db");
const { normalizeJobApplicationStatus } = require("./lib/status");
const { scanJobApplication } = require("./services/scanJobApplication");
const { startBackgroundScanner } = require("./background/backgroundScanner");
const ingestEmailRoutes = require("./routes/ingestEmail");
const { getApplicationExplanation } = require("./services/getApplicationExplanation");
const { getSankeyFlow } = require("./services/getSankeyFlow");
const app = express();
const importStatusRoutes = require("./routes/importStatus");
const PORT = Number(process.env.PORT || 4000);
const googleOAuthRoutes = require("./routes/googleOAuth");
app.post("/auth/logout", (req, res) => {
  res.clearCookie("jp_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // true in prod
    path: "/",
  });
  res.json({ ok: true });
});


// ------------------------------------------------------------
// GLOBAL MIDDLEWARE
// ------------------------------------------------------------

const WEB_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: WEB_ORIGINS,
    credentials: true,
  })
);
app.options(
  "*",
  cors({
    origin: WEB_ORIGINS,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use("/auth/google", googleOAuthRoutes);

// Session-aware middleware (req.user)
app.use((req, res, next) => {
  const sessionId = req.cookies?.jp_session;
  if (!sessionId) return next();

  const row = db
    .prepare(
      `
      SELECT
        users.id AS user_id,
        users.email
      FROM user_sessions
      JOIN users ON users.id = user_sessions.user_id
      WHERE user_sessions.id = ?
        AND user_sessions.revoked_at IS NULL
        AND (user_sessions.expires_at IS NULL OR user_sessions.expires_at > ?)
      LIMIT 1
    `
    )
    .get(String(sessionId), new Date().toISOString());

  if (row?.user_id) {
    req.user = {
      id: row.user_id,
      email: row.email,
    };
  }

  next();
});

app.use(importStatusRoutes);

// ------------------------------------------------------------
// DEMO READ OVERRIDE (unauthenticated, guaranteed)
// ------------------------------------------------------------
app.use("/applications", (req, res, next) => {
  if (req.method !== "GET") return next();

  // If already authenticated, let normal handler run
  if (req.user?.id) return next();

  const demoUserId = getDemoUserId();

  const rows = db
    .prepare(
      `SELECT
         id, user_id,
         company, role, portal, status, url,
         last_checked_at,
         last_bearing_at,
         last_drift_detected_at,
         created_at, updated_at,
         next_interview_at,
         next_interview_source,
         next_interview_link,
         next_interview_email_id
       FROM applications
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .all(demoUserId);

  return res.json({
    ok: true,
    demo: true,
    applications: rows,
  });
});

app.get("/applications/:id/explanation", (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const applicationId = req.params.id;
  const result = getApplicationExplanation(userId, applicationId);

  if (!result.ok && result.code === "NOT_FOUND") {
    return res.status(404).json({ ok: false, error: "not found" });
  }

  return res.json(result);
});

// ------------------------------------------------------------
// FLOW / SANKEY (trust artifact)
// ------------------------------------------------------------
app.get("/flow/sankey", (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const result = getSankeyFlow(userId);
  return res.json(result);
});

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function cleanEmail(from) {
  if (!from) return "";
  const m = String(from).match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

function guessPortal(fromEmail, subject) {
  const hay = `${fromEmail} ${subject}`.toLowerCase();
  if (hay.includes("greenhouse")) return "Greenhouse";
  if (hay.includes("lever")) return "Lever";
  if (hay.includes("workday")) return "Workday";
  if (hay.includes("ashby")) return "Ashby";
  if (hay.includes("smartrecruiters")) return "SmartRecruiters";
  if (hay.includes("icims")) return "iCIMS";
  if (hay.includes("successfactors")) return "SuccessFactors";
  return "Email";
}

function guessStatusFromSubject(subject) {
  const s = String(subject || "").toLowerCase();
  if (s.includes("interview") || s.includes("schedule") || s.includes("call")) return "Interview";
  if (s.includes("offer")) return "Offer";
  if (s.includes("rejected") || s.includes("not selected") || s.includes("declined")) return "Denied";
  return "Applied";
}

function guessCompanyFromEmail(fromEmail) {
  const domain = (fromEmail.split("@")[1] || "").trim();
  const base = (domain.split(".")[0] || domain).trim();
  if (!base) return "Unknown";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function guessRoleFromSubject(subject) {
  const s = String(subject || "").trim();
  if (!s) return "Role";
  return s.replace(/^re:\s*/i, "").replace(/^fw:\s*/i, "").replace(/^fwd:\s*/i, "").slice(0, 80);
}

function bootstrapApplicationsFromInbox(userId, limit = 250) {
  const appsCount = db
    .prepare(`SELECT COUNT(1) c FROM applications WHERE user_id = ?`)
    .get(userId).c;

  if (appsCount > 0) return { created: 0, reason: "already_has_applications" };

  const emails = db
    .prepare(
      `SELECT id, from_email, subject, received_at, raw_body
       FROM inbound_emails
       WHERE user_id = ?
       ORDER BY received_at DESC
       LIMIT ?`
    )
    .all(userId, limit);

  const nowIso = new Date().toISOString();
  let created = 0;
  let skipped = 0;
  let skippedNonJob = 0;


  const insert = db.prepare(
    `INSERT INTO applications (
      id, user_id,
      company, role, portal, status, url,
      is_demo,
      created_at, updated_at
    ) VALUES (
      ?, ?,
      ?, ?, ?, ?, ?,
      0,
      ?, ?
    )`
  );

  for (const e of emails) {
    // Phase 23.3 — filter out non-job emails BEFORE deriving an application
    if (!isJobSignalEmail(e)) {
      skippedNonJob++;
      continue;
    }

    const { company, role, portal, status } = deriveAppFromEmail(e);

    // de-dupe by (user + company + role)
    const key = `${userId}|${company}|${role}`;
    const id = crypto.createHash("sha256").update(key).digest("hex").slice(0, 22);

    const exists = db
      .prepare(`SELECT 1 FROM applications WHERE id = ? AND user_id = ?`)
      .get(id, userId);

    if (exists) {
      skipped++;
      continue;
    }

    // url is NOT NULL in your schema — use a stable email url instead of "email://bootstrap"
    const url = `email://gmail/${e.id || "inbound"}`;

    insert.run(id, userId, company, role, portal, status, url, nowIso, nowIso);
    created++;
  }


    return { created, skipped, skippedNonJob, scanned: emails.length, reason: "bootstrapped_from_inbound_emails" };
}

function requireUser(req, res) {

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: "unauthenticated" });
    return null;
  }
  return String(userId);
}


// Stable demo identity: use a real user row in your DB so existing data works.
// You can set DEMO_USER_EMAIL in .env, otherwise we default.
function getDemoUserId() {
  const demoEmail = String(process.env.DEMO_USER_EMAIL || "demo@jobport.local")
    .trim()
    .toLowerCase();

  const nowIso = new Date().toISOString();

  let user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(demoEmail);

  if (!user) {
    const id = crypto.randomUUID();
    db.prepare(
      `
      INSERT INTO users (id, email, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `
    ).run(id, demoEmail, nowIso, nowIso);

    user = { id };
  }

  return String(user.id);
}

// ------------------------------------------------------------
// HEALTH
// ------------------------------------------------------------
app.get("/health", (req, res) => res.json({ ok: true }));

// ------------------------------------------------------------
// ROUTE MOUNTS (Email ingestion)
// ------------------------------------------------------------
app.use("/ingest", ingestEmailRoutes);

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------
app.post("/auth/dev-login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, error: "email is required" });

  const nowIso = new Date().toISOString();

  let user = db.prepare(`SELECT id, email FROM users WHERE email = ?`).get(email);

  if (!user) {
    const id = crypto.randomUUID();
    db.prepare(
      `
      INSERT INTO users (id, email, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      `
    ).run(id, email, nowIso, nowIso);

    user = { id, email };
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  db.prepare(
    `
    INSERT INTO user_sessions (id, user_id, created_at, expires_at, revoked_at)
    VALUES (?, ?, ?, ?, NULL)
    `
  ).run(sessionId, user.id, nowIso, expiresAt);

  res.cookie("jp_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
  });

  return res.json({ ok: true, user, session: { id: sessionId, expiresAt } });
});

app.post("/auth/logout", (req, res) => {
  const sid = req.cookies?.jp_session;
  if (sid) {
    db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), String(sid));
  }
  res.clearCookie("jp_session");
  return res.json({ ok: true });
});

app.get("/auth/me", (req, res) => {
  return res.json({ ok: true, user: req.user || null });
});

// ------------------------------------------------------------
// APPLICATIONS
// ------------------------------------------------------------

// Option 1 Demo Mode behavior:
// - If authenticated: return real user applications
// - If NOT authenticated: return demo user's applications (read-only)

app.get("/applications", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  // Demo reads are allowed by requireUser() returning "__demo__"
  // but we do NOT want demo behavior anymore.
  if (userId === "__demo__") {
    return res.json({ ok: true, demo: true, applications: [] });
  }

  // Phase 23.4 — ensure inbound emails are attached (idempotent)
  try {
    await attachInboundEmailsToApplications(userId, 300);
  } catch (_) {}

  // Query AFTER attach so the list reflects newly created rows
  const rows = db
    .prepare(
      `SELECT id, user_id, company, role, portal, status, url, is_demo, pinned,
              created_at, updated_at,
              next_interview_at, next_interview_source, next_interview_link, next_interview_email_id
       FROM applications
       WHERE user_id = ?
       ORDER BY
         CASE
           WHEN next_interview_at IS NOT NULL THEN 0
           WHEN status LIKE '%Interview%' THEN 1
           WHEN status LIKE '%Offer%' THEN 2
           WHEN status LIKE '%Denied%' OR status LIKE '%Rejected%' THEN 4
           ELSE 3
         END,
         datetime(updated_at) DESC`
    )
    .all(String(userId));

  return res.json({ ok: true, demo: false, applications: rows });
});

app.get("/applications/:id", (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { id } = req.params;

  const row = db
    .prepare(
      `
      SELECT *
      FROM applications
      WHERE id = ? AND user_id = ?
      `
    )
    .get(String(id), String(userId));

  if (!row) {
    return res.status(404).json({ ok: false, error: "Job application not found" });
  }

  res.json({ ok: true, application: row });
});

app.post("/applications/:id/pin", (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  if (userId === "__demo__") {
    return res.status(403).json({ ok: false, error: "demo mode" });
  }

  const { id } = req.params;
  const pinned = req.body?.pinned ? 1 : 0;

  const row = db
    .prepare(
      `
      UPDATE applications
      SET pinned = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
      `
    )
    .run(pinned, String(id), String(userId));

  if (!row.changes) {
    return res.status(404).json({ ok: false, error: "not found" });
  }

  return res.json({ ok: true, pinned });
});

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

    if (!companyC || !roleC || !urlC) {
      return res.status(400).json({ ok: false, error: "company, role, and url are required" });
    }

    const FREE_LIMIT = Number(process.env.FREE_PLAN_MAX_APPLICATIONS || 1);

    const existingCount = db
      .prepare(`SELECT COUNT(1) AS c FROM applications WHERE user_id = ?`)
      .get(userId)?.c;

    if (Number(existingCount || 0) >= FREE_LIMIT) {
      return res.status(403).json({
        ok: false,
        code: "FREE_LIMIT_REACHED",
        error: `Free plan supports tracking ${FREE_LIMIT} job application${
          FREE_LIMIT === 1 ? "" : "s"
        }. Upgrade to track more.`,
      });
    }

    const id = newId();
    const nowIso = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO applications (
        id, user_id,
        company, role, portal, status, url,
        is_demo,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      0,
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

app.post("/applications/:id/take-bearing", async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const result = await scanJobApplication({
      applicationId: String(req.params.id),
      userId,
      source: "manual",
    });

    res.json(result);
  } catch (err) {
    res.status(err?.statusCode || 500).json({
      ok: false,
      error: err?.message || "Scan failed",
    });
  }
});

app.get("/applications/:id/events", (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const applicationId = String(req.params.id || "");

  const appRow = db
    .prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ?`)
    .get(applicationId, userId);

  if (!appRow) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  const rows = db
    .prepare(
      `SELECT
         id,
         application_id,
         event_type,
         status_changed,
         drift_detected,
         prev_status_signal,
         next_status_signal,
         checked_at,
         source,
         created_at
       FROM application_events
       WHERE application_id = ?
       ORDER BY COALESCE(checked_at, created_at) DESC`
    )
    .all(applicationId);

  return res.json({ ok: true, events: rows });
});

app.get("/me", (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false });
  }

  res.json({
    ok: true,
    user: {
      id: req.user.id,
      email: req.user.email || null,
    },
  });
});

// ------------------------------------------------------------
// ALERTS (demo-friendly reads; auth for writes)
// ------------------------------------------------------------
app.get("/alerts", (req, res) => {
  const userId = req.user?.id ? String(req.user.id) : getDemoUserId();

  const rows = db
    .prepare(
      `
      WITH interview_alerts AS (
        SELECT
          'interview' AS event_id,
          a.id AS application_id,
          'interview' AS event_type,
          0 AS status_changed,
          0 AS drift_detected,
          NULL AS prev_status_signal,
          NULL AS next_status_signal,
          NULL AS checked_at,
          COALESCE(a.next_interview_at, datetime('now')) AS created_at,
          'system' AS source,
          a.company,
          a.role,
          a.portal,
          a.status,
          a.url,
          a.alerts_cleared_at,
          a.next_interview_link,
          a.next_interview_email_id
        FROM applications a
        WHERE a.user_id = ?
          AND (
            (a.next_interview_at IS NOT NULL AND datetime(a.next_interview_at) > datetime('now'))
            OR (a.next_interview_link IS NOT NULL AND a.next_interview_link != '')
          )
          AND (
            a.alerts_cleared_at IS NULL
            OR (
              (a.next_interview_at IS NOT NULL AND datetime(a.next_interview_at) > a.alerts_cleared_at)
              OR (a.next_interview_at IS NULL AND datetime('now') > a.alerts_cleared_at)
            )
          )
      ),
      ranked_events AS (
        SELECT
          e.*,
          ROW_NUMBER() OVER (
            PARTITION BY e.application_id
            ORDER BY
              CASE
                WHEN e.status_changed = 1 THEN 1
                WHEN e.drift_detected = 1 THEN 2
                WHEN e.event_type = 'email_matched' THEN 3
                ELSE 99
              END,
              e.created_at DESC
          ) AS rn
        FROM application_events e
        JOIN applications a ON a.id = e.application_id
        WHERE e.user_id = ?
          AND a.user_id = ?
          AND (
            e.status_changed = 1
            OR e.drift_detected = 1
            OR e.event_type = 'email_matched'
          )
          AND (a.alerts_cleared_at IS NULL OR e.created_at > a.alerts_cleared_at)
          AND NOT EXISTS (
            SELECT 1
            FROM application_events e2
            WHERE e2.application_id = e.application_id
              AND e2.user_id = e.user_id
              AND e2.event_type = e.event_type
              AND e2.created_at > datetime(e.created_at, '-6 hours')
              AND e2.created_at < e.created_at
          )
      )
      SELECT
        ia.event_id,
        ia.application_id,
        ia.event_type,
        ia.status_changed,
        ia.drift_detected,
        ia.prev_status_signal,
        ia.next_status_signal,
        ia.checked_at,
        ia.created_at,
        ia.source,
        ia.company,
        ia.role,
        ia.portal,
        ia.status,
        ia.url,
        ia.alerts_cleared_at,
        ia.next_interview_link,
        ia.next_interview_email_id
      FROM interview_alerts ia

      UNION ALL

      SELECT
        re.id AS event_id,
        re.application_id,
        re.event_type,
        re.status_changed,
        re.drift_detected,
        re.prev_status_signal,
        re.next_status_signal,
        re.checked_at,
        re.created_at,
        re.source,
        a.company,
        a.role,
        a.portal,
        a.status,
        a.url,
        a.alerts_cleared_at,
        NULL AS next_interview_link,
        NULL AS next_interview_email_id
      FROM ranked_events re
      JOIN applications a ON a.id = re.application_id
      WHERE re.rn = 1

      ORDER BY created_at DESC
      LIMIT 200
      `
    )
    .all(userId, userId, userId);

  res.json({ ok: true, demo: !req.user, alerts: rows });
});

app.post("/alerts/clear", (req, res) => {
  const u = requireUser(req, res);
  if (!u) return;

  const userId = String(u.id);
  const applicationId = String(req.body?.applicationId || "").trim();

  if (!applicationId) {
    return res.status(400).json({ ok: false, error: "applicationId is required" });
  }

  // Acknowledge: suppress current alert until next_interview_* changes.
  // If no next_interview_at, clear with now() so link-only alerts are suppressed.
  const row = db
    .prepare(
      `
      UPDATE applications
      SET alerts_cleared_at = COALESCE(next_interview_at, datetime('now')),
          updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
      `
    )
    .run(applicationId, userId);

  res.json({ ok: true, updated: row.changes });
});


// ------------------------------------------------------------
// START SERVER + BACKGROUND SCANS
// ------------------------------------------------------------

const server = app.listen(PORT, () => {
  console.log("[api] listening on http://localhost:" + PORT);

  const enabled = String(process.env.ENABLE_BACKGROUND_SCANS || "").toLowerCase() === "true";
  const tickMs = Number(process.env.BG_SCAN_TICK_MS || 60000);
  const batchSize = Number(process.env.BG_SCAN_BATCH_SIZE || 5);
  const concurrency = Number(process.env.BG_SCAN_CONCURRENCY || 2);

  startBackgroundScanner({ enabled, tickMs, batchSize, concurrency });
});

server.on("error", function (err) {
  console.log("[api] server error:", err && err.message ? err.message : err);
});
