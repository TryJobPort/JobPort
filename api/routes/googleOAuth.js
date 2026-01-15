// api/routes/googleOAuth.js
// Phase 21.1 → 26
// Google OAuth (Read-only Inbox Connect)
// - Forces account chooser (Phase 26.2)
// - Clears Gmail inbox data on successful login (Phase 26.3)

const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

const COOKIE_SESSION = "jp_session";
const COOKIE_OAUTH_STATE = "jp_oauth_state";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`[oauth] Missing env: ${name}`);
  return v;
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function newId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function base64Url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomState() {
  return base64Url(crypto.randomBytes(24));
}

function getWebBaseUrl() {
  return (process.env.WEB_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function cookieOpts(req) {
  const trustProxy = process.env.TRUST_PROXY === "1";
  const isSecure =
    (trustProxy && req.headers["x-forwarded-proto"] === "https") ||
    (req.protocol === "https");

  return {
    httpOnly: true,
    sameSite: "lax",
    secure: !!isSecure,
    path: "/",
  };
}

function setCookie(res, name, value, req, extra = {}) {
  res.cookie(name, value, { ...cookieOpts(req), ...extra });
}

function clearCookie(res, name, req) {
  res.clearCookie(name, { ...cookieOpts(req) });
}

async function exchangeCodeForTokens({ code }) {
  const body = new URLSearchParams();
  body.set("code", code);
  body.set("client_id", requireEnv("GOOGLE_CLIENT_ID"));
  body.set("client_secret", requireEnv("GOOGLE_CLIENT_SECRET"));
  body.set("redirect_uri", requireEnv("GOOGLE_REDIRECT_URI"));
  body.set("grant_type", "authorization_code");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error_description || "token_exchange_failed");
  }
  return json;
}

async function fetchUserInfo(accessToken) {
  const resp = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error_description || "userinfo_failed");
  }
  return json;
}

function upsertUserFromGoogle({ email, name, picture }) {
  const existing = db.prepare(
    `SELECT * FROM users WHERE email = ? LIMIT 1`
  ).get(email);

  if (existing) {
    db.prepare(
      `UPDATE users SET updated_at = ? WHERE id = ?`
    ).run(nowIso(), existing.id);
    return existing.id;
  }

  const userId = newId();
  db.prepare(
    `INSERT INTO users (id, email, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  ).run(userId, email, nowIso(), nowIso());

  return userId;
}

function upsertOAuthAccount({
  userId,
  providerAccountId,
  accessToken,
  refreshToken,
  scope,
  tokenType,
  expiresInSeconds,
}) {
  const expiresAt = expiresInSeconds
    ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    : "";

  const existing = db.prepare(
    `SELECT * FROM oauth_accounts
     WHERE provider = 'google'
       AND provider_account_id = ?
     LIMIT 1`
  ).get(providerAccountId);

  if (existing) {
    db.prepare(
      `UPDATE oauth_accounts
       SET user_id = ?, access_token = ?, refresh_token = ?, scope = ?,
           token_type = ?, expires_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      userId,
      accessToken,
      refreshToken || existing.refresh_token,
      scope,
      tokenType,
      expiresAt,
      nowIso(),
      existing.id
    );
    return;
  }

  db.prepare(
    `INSERT INTO oauth_accounts
      (id, user_id, provider, provider_account_id,
       access_token, refresh_token, scope, token_type,
       expires_at, created_at, updated_at)
     VALUES (?, ?, 'google', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId(),
    userId,
    providerAccountId,
    accessToken,
    refreshToken || "",
    scope,
    tokenType,
    expiresAt,
    nowIso(),
    nowIso()
  );
}

function createSession(userId) {
  const sessionId = newId();
  db.prepare(
    `INSERT INTO user_sessions
      (id, user_id, created_at, expires_at, revoked_at)
     VALUES (?, ?, ?, ?, NULL)`
  ).run(sessionId, userId, nowIso(), addDaysIso(30));
  return sessionId;
}

// GET /auth/google/start
router.get("/start", (req, res) => {
  try {
    const state = randomState();
    setCookie(res, COOKIE_OAUTH_STATE, state, req, { maxAge: 10 * 60 * 1000 });

    const params = new URLSearchParams();
    params.set("client_id", requireEnv("GOOGLE_CLIENT_ID"));
    params.set("redirect_uri", requireEnv("GOOGLE_REDIRECT_URI"));
    params.set("response_type", "code");
    params.set("scope", [
      "https://www.googleapis.com/auth/gmail.readonly",
      "openid",
      "email",
      "profile",
    ].join(" "));
    params.set("access_type", "offline");
    params.set("include_granted_scopes", "true");
    params.set("prompt", "select_account consent");
    params.set("state", state);

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /auth/google/callback
router.get("/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) throw new Error(error);

    const expected = req.cookies?.[COOKIE_OAUTH_STATE];
    if (!expected || state !== expected) throw new Error("bad_state");
    clearCookie(res, COOKIE_OAUTH_STATE, req);

    const tokens = await exchangeCodeForTokens({ code });
    const userInfo = await fetchUserInfo(tokens.access_token);

    const userId = upsertUserFromGoogle({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
    });

    upsertOAuthAccount({
      userId,
      providerAccountId: userInfo.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      expiresInSeconds: tokens.expires_in,
    });

    // Phase 26.3 — clean Gmail inbox for fresh import
    db.prepare(
      `DELETE FROM inbound_emails WHERE user_id = ? AND source = 'gmail'`
    ).run(userId);

    const sessionId = createSession(userId);
    setCookie(res, COOKIE_SESSION, sessionId, req, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${getWebBaseUrl()}/importing`);
  } catch (e) {
    res.redirect(
      `${getWebBaseUrl()}/?oauth_error=${encodeURIComponent(e.message)}`
    );
  }
});

module.exports = router;
