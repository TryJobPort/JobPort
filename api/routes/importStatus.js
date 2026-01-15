// ------------------------------------------------------------
// IMPORT STATUS (Gmail ingestion + progress reporting)
//
// Current behavior (Phase 25.6):
// - Authenticated endpoint (jp_session required)
// - Idempotently kicks off a Gmail sync for the user
// - Returns real-time counters and stage-level progress
//
// What this DOES today:
// - Fetches up to N Gmail messages (default 350)
// - Stores raw inbound emails (source = 'gmail')
// - Extracts application-like signals from subjects/bodies
// - Attaches emails to applications via heuristic matching
// - Emits interview alerts when an email contains a link
//
// Known limitations (by design, Phase 25):
// - No semantic classification yet (marketing vs job-related)
// - Any email with a URL may be treated as “interview-like”
// - Calendar links, promos, receipts, and newsletters can
//   incorrectly surface as interview alerts
// - interviews_detected reflects link presence only, NOT intent
//
// This endpoint is intentionally dumb:
// - It proves the ingestion → attachment → alert pipeline
// - Precision is deferred to Phase 26 (classification + filters)
//
// ------------------------------------------------------------

const express = require("express");
const { ensureInitialSyncKickoff, getImportProgress } = require("../services/gmailSync");

const router = express.Router();

function requireAuth(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: "unauthenticated" });
    return null;
  }
  return String(userId);
}

router.get("/import/status", (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  // Non-blocking kickoff.
  // Default behavior: start once, then subsequent polls return progress.
  // To force a re-run (rare), pass ?force=1
  const force = String(req.query?.force || "") === "1";

  // IMPORTANT:
  // This is intentionally fire-and-forget, but we MUST attach a catch handler
  // so token refresh failures can't become unhandled rejections that crash the API.
  Promise.resolve(ensureInitialSyncKickoff(userId, { limit: 350, force })).catch((e) => {
    console.error("[import/status] kickoff failed:", e?.message || e);
    // keep returning progress; error will be visible via getImportProgress()
  });

  return res.json(getImportProgress(userId));
});

module.exports = router;
