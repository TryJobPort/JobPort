// api/services/scanJobApplication.js
const crypto = require("crypto");
const db = require("../db");

const { fetchPageHtml } = require("../utils/fetchPageHtml");
const { extractVisibleText } = require("../utils/extractVisibleText");
const { inferStatusSignal } = require("../utils/inferStatusSignal");
const computeBackoffMs = require("../utils/computeBackoffMs");

const { normalizeJobApplicationStatus } = require("../lib/status");

async function scanJobApplication({ applicationId, userId, source = "manual" }) {
  const app = db
    .prepare(`SELECT * FROM applications WHERE id = ? AND user_id = ? LIMIT 1`)
    .get(applicationId, userId);

  if (!app) {
    const e = new Error("NOT_FOUND");
    e.statusCode = 404;
    throw e;
  }

  if (!app.url) {
    const e = new Error("MISSING_URL");
    e.statusCode = 400;
    throw e;
  }

  const nowIso = new Date().toISOString();

  try {
    // 1) Fetch + extract visible text
    const fetched = await fetchPageHtml(app.url);
    const html = fetched?.html || "";

    const rawVisible = extractVisibleText(html);
    const visibleText =
      typeof rawVisible === "string"
        ? rawVisible
        : JSON.stringify(rawVisible ?? "");

    // 2) Normalize + hash
    const normalized = visibleText.replace(/\s+/g, " ").trim().toLowerCase();

    const signalMark = crypto
      .createHash("sha256")
      .update(normalized, "utf8")
      .digest("hex");

    const prevSignalMark = app.last_signal_mark || null;
    const driftDetected = !!prevSignalMark && prevSignalMark !== signalMark;

    // 3) Status inference
    const inferred = inferStatusSignal({ visibleText, url: app.url });

    const prevStatusRaw = app.last_status_signal || "Applied";
    const nextStatusRaw = inferred?.signal || "Applied";

    const prevStatus = normalizeJobApplicationStatus(prevStatusRaw);
    const nextStatus = normalizeJobApplicationStatus(nextStatusRaw);

    const statusChanged = prevStatus !== nextStatus;

    // 4) Persist application state
    db.prepare(
      `UPDATE applications SET
        last_signal_mark = ?,
        last_bearing_at = ?,
        baseline_established_at = COALESCE(baseline_established_at, ?),
        last_checked_at = ?,
        last_drift_detected_at = ?,
        last_status_signal = ?,
        last_status_signal_at = ?,
        last_status_change_at = ?,
        updated_at = ?
      WHERE id = ? AND user_id = ?`
    ).run(
      signalMark,
      nowIso,
      nowIso, // baseline_established_at (only set once)
      nowIso,
      driftDetected ? nowIso : app.last_drift_detected_at,
      nextStatus,
      nowIso,
      statusChanged ? nowIso : app.last_status_change_at,
      nowIso,
      applicationId,
      userId
    );

    // 5) Event logging
    let eventType = null;
    let alertKind = null;

    if (statusChanged) {
      eventType = "status_signal_changed";
      alertKind = "status";
    } else if (driftDetected) {
      eventType = "page_drift_detected";
      alertKind = "drift";
    }

    if (eventType) {
      const payload = {
        source,
        url: app.url,

        prev_status_signal: prevStatus,
        next_status_signal: nextStatus,
        status_changed: statusChanged,

        prev_raw_signal: prevStatusRaw,
        next_raw_signal: nextStatusRaw,
        inferred,
        inferred_raw_signal: inferred?.signal || null,

        prev_signal_mark: prevSignalMark,
        next_signal_mark: signalMark,
        drift_detected: driftDetected,
      };

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
        applicationId,
        userId,
        eventType,
        JSON.stringify(payload),
        source,
        prevStatus,
        nextStatus,
        statusChanged ? 1 : 0,
        driftDetected ? 1 : 0,
        prevSignalMark,
        signalMark,
        nowIso,
        nowIso
      );
    }

    // reset failure tracking
    db.prepare(
      `UPDATE applications SET
        consecutive_scan_failures = 0,
        last_scan_ok_at = ?,
        last_scan_error_at = NULL,
        last_scan_error_code = NULL,
        last_scan_error_message = NULL,
        last_scan_error = NULL
       WHERE id = ? AND user_id = ?`
    ).run(nowIso, applicationId, userId);

    return {
      ok: true,
      source,
      applicationId,
      userId,
      status: nextStatus,
      prevStatus,
      nextStatus,
      statusChanged,
      driftDetected,
      alertKind,
      checkedAt: nowIso,
    };
  } catch (err) {
    const failures = (app.consecutive_scan_failures || 0) + 1;
    const backoffMs = computeBackoffMs(failures);
    const nextScanAt = new Date(Date.now() + backoffMs).toISOString();

    db.prepare(
      `UPDATE applications SET
        consecutive_scan_failures = ?,
        last_scan_error_at = ?,
        last_scan_error_code = ?,
        last_scan_error_message = ?,
        last_scan_error = ?,
        next_scan_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      failures,
      nowIso,
      err?.code || "SCAN_FAILED",
      err?.message || "Scan failed",
      err?.message || "Scan failed",
      nextScanAt,
      applicationId,
      userId
    );

    throw err;
  }
}

module.exports = { scanJobApplication };
