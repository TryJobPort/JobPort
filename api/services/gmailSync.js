// api/services/gmailSync.js
//
// Phase 21.2 — Initial Gmail Sync (Real Data)
// Phase 25.6 fixes:
// - Hard timeout on Google/Gmail fetches (prevents "running/0 forever")
// - Progress includes `stage` so /import/status tells you where you’re stuck
// - Fetch FULL messages and store decoded body into inbound_emails.raw_body

const db = require("../db");
const { attachInboundEmailsToApplications } = require("./attachEmailsToApplications");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

const inFlightByUser = new Map(); // userId -> Promise
const progressByUser = new Map(); // userId -> progress object

function nowIso() {
  return new Date().toISOString();
}

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function getProgress(userId) {
  return (
    progressByUser.get(String(userId)) || {
      ok: true,
      state: "idle",
      stage: null,
      started_at: null,
      finished_at: null,
      last_synced_at: null,
      emails_target: 0,
      emails_scanned: 0,
      emails_inserted: 0,
      emails_skipped: 0,
      applications_found: 0,
      interviews_detected: 0,
      error: null,
    }
  );
}

function setProgress(userId, patch) {
  const cur = getProgress(userId);
  progressByUser.set(String(userId), { ...cur, ...patch });
}

function requireOauthRow(userId) {
  const row = db
    .prepare(
      `
      SELECT *
      FROM oauth_accounts
      WHERE user_id = ?
        AND provider = 'google'
      ORDER BY updated_at DESC
      LIMIT 1
    `
    )
    .get(String(userId));

  if (!row) {
    const err = new Error("missing_oauth_account");
    err.code = "MISSING_OAUTH";
    throw err;
  }
  return row;
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return false;
  return t <= Date.now() + 60_000;
}

async function refreshAccessTokenIfNeeded(oauthRow) {
  const accessToken = oauthRow.access_token || "";
  const refreshToken = oauthRow.refresh_token || "";
  const expiresAt = oauthRow.expires_at || "";

  if (!refreshToken) return { accessToken, expiresAt };
  if (!isExpired(expiresAt) && accessToken) return { accessToken, expiresAt };

  const params = new URLSearchParams();
  params.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
  params.set("client_secret", process.env.GOOGLE_CLIENT_SECRET || "");
  params.set("refresh_token", refreshToken);
  params.set("grant_type", "refresh_token");

  const resp = await fetchWithTimeout(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
    15000
  );

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(json?.error_description || json?.error || "refresh_failed");
    e.code = "TOKEN_REFRESH_FAILED";
    throw e;
  }

  const newAccess = json.access_token || "";
  const newExpiresAt = json.expires_in
    ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
    : expiresAt;

  try {
    db.prepare(
      `
      UPDATE oauth_accounts
      SET access_token = ?,
          expires_at = ?,
          updated_at = ?
      WHERE id = ?
      `
    ).run(newAccess, newExpiresAt || "", nowIso(), oauthRow.id);
  } catch (_) {
    // non-fatal
  }

  return { accessToken: newAccess, expiresAt: newExpiresAt };
}

async function gmailListMessages({ accessToken, maxResults }) {
  const url = new URL(`${GMAIL_API_BASE}/users/me/messages`);
  url.searchParams.set("maxResults", String(maxResults || 200));
  url.searchParams.set("labelIds", "INBOX");

  const resp = await fetchWithTimeout(
    url.toString(),
    { headers: { authorization: `Bearer ${accessToken}` } },
    15000
  );

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(json?.error?.message || "gmail_list_failed");
    e.code = "GMAIL_LIST_FAILED";
    throw e;
  }

  return json?.messages || [];
}

async function gmailGetMessageFull({ accessToken, id }) {
  const url = new URL(`${GMAIL_API_BASE}/users/me/messages/${encodeURIComponent(id)}`);
  url.searchParams.set("format", "full");

  const resp = await fetchWithTimeout(
    url.toString(),
    { headers: { authorization: `Bearer ${accessToken}` } },
    15000
  );

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(json?.error?.message || "gmail_get_failed");
    e.code = "GMAIL_GET_FAILED";
    throw e;
  }

  return json;
}

function headerValue(msg, name) {
  const headers = msg?.payload?.headers || [];
  const h = headers.find(
    (x) => String(x?.name || "").toLowerCase() === String(name).toLowerCase()
  );
  return (h?.value || "").trim();
}

function computeReceivedAt(msg) {
  const internalDateMs = msg?.internalDate ? Number(msg.internalDate) : null;
  if (internalDateMs && Number.isFinite(internalDateMs)) {
    return new Date(internalDateMs).toISOString();
  }
  const date = headerValue(msg, "Date");
  if (date) {
    const t = Date.parse(date);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return nowIso();
}

function inboundExists(userId, gmailId) {
  const id = `gmail_${gmailId}`;
  const row = db
    .prepare(`SELECT 1 FROM inbound_emails WHERE user_id = ? AND id = ? LIMIT 1`)
    .get(String(userId), id);
  return !!row;
}

function base64UrlDecodeToUtf8(s) {
  if (!s) return "";
  const b64 = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Buffer.from(b64 + pad, "base64").toString("utf8");
}

function collectBodies(node, out) {
  if (!node) return;
  const mime = String(node.mimeType || "").toLowerCase();

  if (node.body?.data && (mime === "text/plain" || mime === "text/html")) {
    out.push({ mime, text: base64UrlDecodeToUtf8(node.body.data) });
  }

  const parts = node.parts || [];
  for (const p of parts) collectBodies(p, out);
}

function stripHtml(html) {
  const s = String(html || "");

  // Preserve anchor hrefs: "Text (https://...)" before stripping tags
  const withLinks = s.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => {
      const t = String(text || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const h = String(href || "").trim();
      if (!h) return t || "";
      if (!t) return h;
      return `${t} (${h})`;
    }
  );

  return withLinks
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}


function extractRawBody(msg) {
  const found = [];
  collectBodies(msg?.payload, found);

  const plain = found.find((x) => x.mime === "text/plain")?.text;
  if (plain && plain.trim()) return plain.trim();

  const html = found.find((x) => x.mime === "text/html")?.text;
  if (html && html.trim()) return stripHtml(html);

  const snippet = String(msg?.snippet || "");
  return snippet || "[no snippet]";
}

function insertInboundEmailRow(userId, msg) {
  const gmailId = String(msg?.id || "");
  const id = `gmail_${gmailId}`;

  const from = headerValue(msg, "From") || "";
  const to = headerValue(msg, "To") || "";
  const subject = headerValue(msg, "Subject") || "";
  const receivedAt = computeReceivedAt(msg);

  const rawBody = extractRawBody(msg);
  const createdAt = nowIso();

  db.prepare(
    `
    INSERT INTO inbound_emails (
      id,
      user_id,
      source,
      from_email,
      to_email,
      subject,
      raw_body,
      received_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(id, String(userId), "gmail", from, to, subject, rawBody, receivedAt, createdAt);
}

async function runInitialSync(userId, opts) {
  const limit = Number(opts?.limit || 300);

  setProgress(userId, {
    ok: true,
    state: "running",
    stage: "start",
    started_at: nowIso(),
    finished_at: null,
    last_synced_at: null,
    emails_target: limit,
    emails_scanned: 0,
    emails_inserted: 0,
    emails_skipped: 0,
    error: null,
  });

  setProgress(userId, { stage: "oauth_lookup" });
  const oauth = requireOauthRow(userId);

  setProgress(userId, { stage: "token_refresh" });
  const { accessToken } = await refreshAccessTokenIfNeeded(oauth);

  if (!accessToken) {
    const e = new Error("missing_access_token");
    e.code = "MISSING_ACCESS_TOKEN";
    throw e;
  }

  setProgress(userId, { stage: "gmail_list" });
  const messages = await gmailListMessages({ accessToken, maxResults: limit });
  setProgress(userId, { emails_target: messages.length, stage: "loop" });

  let scanned = 0;
  let inserted = 0;
  let skipped = 0;

  for (const m of messages) {
    scanned += 1;
    setProgress(userId, { emails_scanned: scanned });

    const mid = String(m?.id || "");
    if (!mid) {
      skipped += 1;
      setProgress(userId, { emails_skipped: skipped });
      continue;
    }

    if (inboundExists(userId, mid)) {
      skipped += 1;
      setProgress(userId, { emails_skipped: skipped });
      continue;
    }

    const msg = await gmailGetMessageFull({ accessToken, id: mid });
    insertInboundEmailRow(userId, msg);

    inserted += 1;
    setProgress(userId, { emails_inserted: inserted });
  }

  setProgress(userId, { stage: "attach" });
  try {
    await attachInboundEmailsToApplications(userId, 500);
  } catch (_) {
    // non-fatal
  }

  setProgress(userId, {
    state: "done",
    stage: "done",
    finished_at: nowIso(),
    last_synced_at: nowIso(),
  });
}

async function ensureInitialSyncKickoff(userId, opts) {
  const uid = String(userId);
  const force = !!opts?.force;

  const cur = getProgress(uid);

  if (cur.state === "running") return;
  if (inFlightByUser.has(uid)) return;
  if (cur.state === "done" && !force) return;

  const p = (async () => {
    try {
      await runInitialSync(uid, opts);
    } catch (e) {
      setProgress(uid, {
        state: "error",
        stage: getProgress(uid).stage || "error",
        finished_at: nowIso(),
        error: e?.name === "AbortError" ? "network_timeout" : e?.message || "sync_failed",
      });
      console.error("[gmail-sync] initial sync failed:", e?.message || e);
      return null;
    } finally {
      inFlightByUser.delete(uid);
    }
  })();

  inFlightByUser.set(uid, p);
}

function getImportProgress(userId) {
  const uid = String(userId);
  const p = getProgress(uid);

  let applicationsFound = 0;
  let interviewsDetected = 0;

  try {
    applicationsFound = db
      .prepare(`SELECT COUNT(1) AS c FROM applications WHERE user_id = ?`)
      .get(uid)?.c;
  } catch (_) {}

  try {
    interviewsDetected = db
      .prepare(
        `SELECT COUNT(1) AS c FROM applications WHERE user_id = ? AND next_interview_at IS NOT NULL`
      )
      .get(uid)?.c;
  } catch (_) {}

  return {
    ok: true,
    state: p.state,
    stage: p.stage || null,
    started_at: p.started_at,
    finished_at: p.finished_at,
    last_synced_at: p.last_synced_at,
    emails_target: p.emails_target,
    emails_scanned: p.emails_scanned,
    emails_inserted: p.emails_inserted,
    emails_skipped: p.emails_skipped,
    applications_found: applicationsFound,
    interviews_detected: interviewsDetected,
    error: p.error,
  };
}

module.exports = {
  ensureInitialSyncKickoff,
  getImportProgress,
};
