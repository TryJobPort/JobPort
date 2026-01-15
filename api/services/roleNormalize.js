// api/services/roleNormalize.js
//
// Phase 24.2 — Role normalization
// Goal: turn subject-y role strings into clean job titles.
//
// Principles:
// - Conservative: only normalize when we have a clear role candidate.
// - Never return empty; fall back to a safe placeholder when needed.

function stripPrefixes(s) {
  return String(s || "")
    .trim()
    .replace(/^\s*(re|fw|fwd)\s*:\s*/i, "")
    .replace(/^\s*\[\s*[^\]]+\s*\]\s*/i, "") // leading [Company]
    .trim();
}

function stripReqJunk(s) {
  return String(s || "")
    .replace(/\(\s*(req|requisition|job)\s*(id|#)?\s*[:#-]?\s*[A-Z0-9-]+\s*\)/gi, "")
    .replace(/\b(req|requisition|job)\s*(id|#)?\s*[:#-]?\s*[A-Z0-9-]+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(s) {
  const v = String(s || "").trim();
  if (!v) return "";

  // Keep common acronyms uppercase
  const keepUpper = new Set([
    "UX",
    "UI",
    "QA",
    "SRE",
    "IT",
    "HR",
    "BI",
    "II",
    "III",
    "IV",
    "VP",
    "CFO",
    "CEO",
    "CTO",
  ]);

  return v
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => {
      const raw = w.replace(/[^A-Za-z0-9+/.-]/g, "");
      if (!raw) return w;
      const up = raw.toUpperCase();
      if (keepUpper.has(up)) return up;
      if (/^[A-Z]{2,}$/.test(raw)) return raw; // already an acronym
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    })
    .join(" ")
    .trim();
}

function looksBad(role) {
  const r = String(role || "").toLowerCase();
  if (!r) return true;
  if (r.length < 2) return true;

  const badHits = [
    "interview",
    "phone screen",
    "schedule",
    "your application",
    "application received",
    "application submitted",
    "thank you for applying",
    "next steps",
    "status update",
    "we received",
  ];
  if (badHits.some((k) => r.includes(k))) return true;

  if (r === "role" || r === "position" || r === "job" || r === "opportunity") return true;

  return false;
}

function extractRoleCandidateFromSubject(subject) {
  const s0 = stripReqJunk(stripPrefixes(subject));
  if (!s0) return "";

  const s = s0.replace(/\s*[—–-]\s*/g, " — "); // normalize dashes

  // 1) "Interview for Product Manager" / "Offer for Senior PM"
  let m =
    s.match(
      /\b(interview|phone\s*screen|onsite|on[- ]site|technical\s*screen|offer)\b\s*(?:invitation|invite|scheduled|request|requests|requested|for|:)?\s*(?:for\s+)?(.+?)\s*$/i
    ) || s.match(/\bnext\s+steps\s+for\s+(.+?)\s*$/i);
  if (m && m[2]) return m[2].trim();
  if (m && m[1] && !m[2]) {
    if (/^next\s+steps\s+for\b/i.test(s) && m[1]) return String(m[1]).trim();
  }

  // 2) "Your application for Product Manager at Company"
  m = s.match(/\byour\s+application\s+for\s+(.+?)\s*(?:\bat\b|\(|—|$)/i);
  if (m && m[1]) return m[1].trim();

  // 3) "Thank you for applying — Product Manager" / "Application received: Product Manager"
  m =
    s.match(/\bapplication\s+(?:received|submitted|confirmation|confirmed)\s*[:\-—]\s*(.+?)\s*$/i) ||
    s.match(/\bthank\s+you\s+for\s+applying\b\s*[:\-—]\s*(.+?)\s*$/i);
  if (m && m[1]) return m[1].trim();

  // 4) Bracket prefix: "[Spotify] Product Manager - Application Received"
  m = s.match(/^\s*\[[^\]]+\]\s*(.+?)\s*(?:—|\-|:|\(|$)/);
  if (m && m[1]) return m[1].trim();

  return "";
}

function cleanRoleCandidate(candidate, { company } = {}) {
  let c = stripReqJunk(candidate);
  if (!c) return "";

  // Remove trailing "at Company"
  c = c.replace(/\s+at\s+.+$/i, "").trim();

  // Remove trailing company after a dash ("Product Manager — Company")
  if (company) {
    const co = String(company).trim();
    if (co) {
      const esc = co.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      c = c.replace(new RegExp(`\\s*(?:—|-|:)\\s*${esc}\\s*$`, "i"), "").trim();
    }
  }

  // Remove common trailing status phrases
  c = c
    .replace(/\s*(?:role|position|opportunity)\s*$/i, "")
    .replace(/\s*(?:application|applied|received|submitted|confirmation|update)\s*$/i, "")
    .trim();

  // Hard reject if it still looks like a sentence
  if (c.length > 80) return "";
  if (/[!?]/.test(c)) return "";
  if (/\b(interview|application|candidate|recruit|recruiting|schedule|next\s+steps)\b/i.test(c)) {
    const lc = c.toLowerCase();
    const endsBad = /\b(interview|application|candidate|recruit|recruiting|schedule|next\s+steps)\b\s*$/i.test(lc);
    if (endsBad) return "";
  }

  return titleCase(c);
}

/**
 * normalizeRoleFromEmail
 * - If we can confidently extract a clean role from subject, returns it.
 * - Otherwise returns fallbackRole (or "Role").
 */
function normalizeRoleFromEmail({ subject, company, fallbackRole } = {}) {
  const candidate = extractRoleCandidateFromSubject(subject);
  const cleaned = cleanRoleCandidate(candidate, { company });
  if (cleaned) return cleaned;

  const fb = String(fallbackRole || "Role").trim();
  if (fb) return fb;
  return "Role";
}

/**
 * normalizeRoleFromExisting
 * - For backfill: takes existing role value (often a subject) and tries to clean it.
 */
function normalizeRoleFromExisting({ role, company } = {}) {
  const r0 = String(role || "").trim();
  if (!r0) return "";

  const candidate = extractRoleCandidateFromSubject(r0) || r0;
  const cleaned = cleanRoleCandidate(candidate, { company });
  if (cleaned) return cleaned;

  // If it doesn't look bad, keep as-is (but normalize trivial prefixes/junk)
  const stripped = stripReqJunk(stripPrefixes(r0));
  if (!looksBad(stripped)) return titleCase(stripped);

  return "";
}

module.exports = {
  normalizeRoleFromEmail,
  normalizeRoleFromExisting,
};
