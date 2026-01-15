// api/services/scanLease.js
const crypto = require("crypto");
const os = require("os");
const db = require("../db");

function nowIso() {
  return new Date().toISOString();
}
function msFromNowIso(ms) {
  return new Date(Date.now() + ms).toISOString();
}
function getInstanceId() {
  return process.env.INSTANCE_ID || `${os.hostname()}:${process.pid}`;
}

function tryAcquireApplicationLease({ applicationId, ttlMs }) {
  const owner = getInstanceId();
  const token = crypto.randomUUID();
  const lockedUntil = msFromNowIso(ttlMs);
  const now = nowIso();

  const res = db
    .prepare(
      `
      UPDATE applications
      SET scan_locked_until = ?, scan_lock_owner = ?, scan_lock_token = ?
      WHERE id = ?
        AND (scan_locked_until IS NULL OR scan_locked_until < ?)
    `
    )
    .run(lockedUntil, owner, token, applicationId, now);

  if (res.changes === 1) return { ok: true, token, owner, lockedUntil };
  return { ok: false };
}

function releaseApplicationLease({ applicationId, token }) {
  const res = db
    .prepare(
      `
      UPDATE applications
      SET scan_locked_until = NULL, scan_lock_owner = NULL, scan_lock_token = NULL
      WHERE id = ? AND scan_lock_token = ?
    `
    )
    .run(applicationId, token);

  return { ok: res.changes === 1 };
}

module.exports = {
  tryAcquireApplicationLease,
  releaseApplicationLease,
  getInstanceId,
};
