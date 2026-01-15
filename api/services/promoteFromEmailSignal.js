// api/services/promoteFromEmailSignal.js
//
// Promote application.status + interview metadata from an inbound email signal.
// - Status only moves forward in certainty
// - Denied is terminal
// - Interview metadata promoted deterministically from meeting/calendar URLs
//   (promote earliest upcoming interview when multiple signals arrive)

const db = require("../db");
const { extractInterviewTime } = require("./calendarExtract");
const { normalizeRoleFromEmail } = require("./roleNormalize");
const crypto = require("crypto");

function norm(s) {
  return String(s || "").toLowerCase();
}

function statusRank(status) {
  const s = norm(status);
  if (s.includes("denied") || s.includes("rejected")) return 100;
  if (s.includes("offer")) return 80;
  if (s.includes("interview")) return 60;
  return 10;
}

function meetingRank(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes("meet.google.com")) return 100;
    if (h.includes("zoom.us") || h.endsWith(".zoom.us")) return 90;
    if (h.includes("teams.microsoft.com")) return 85;
    if (h.includes("webex.com") || h.endsWith(".webex.com")) return 80;
    return 10;
  } catch {
    return 0;
  }
}

function extractInterviewAtFromEmailText(text = "") {
  const t = String(text);

  // Date: Monday, January 19  OR  Date: Jan 19
  const dateMatch = t.match(/Date:\s*([A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2})/i);
  // Time: 1:30 – 2:30 PM  OR Time: 1:30 PM
  const timeMatch = t.match(/Time:\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  // Time Zone: America/Denver
  const tzMatch = t.match(/Time\s*Zone:\s*([A-Za-z_]+\/[A-Za-z_]+)\b/i);

  if (!dateMatch || !timeMatch) return null;

  const monthName = dateMatch[2];
  const day = Number(dateMatch[3]);
  const hour12 = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const ampm = timeMatch[3].toUpperCase();

  // Convert to 24h
  let hour = hour12 % 12;
  if (ampm === "PM") hour += 12;

  // Choose year: if the date has already passed this year, bump to next year.
  const now = new Date();
  const year = now.getFullYear();

  // Build a Date in local time first, then convert using timezone offset name if provided.
  // We store ISO; if tz provided, we’ll assume that timezone for interpretation.
  const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
  if (Number.isNaN(monthIndex)) return null;

  // If timezone is provided, best-effort: create ISO as if it’s in that timezone by formatting parts.
  // Minimal approach: store as local time; your UI already displays with tz label.
  const dt = new Date(year, monthIndex, day, hour, minute, 0, 0);

  // If date is in the past (relative), bump a year
  if (dt.getTime() < now.getTime() - 24 * 3600 * 1000) {
    dt.setFullYear(year + 1);
  }

  return dt.toISOString();
}

function classifyStatusFromEmail(emailRow) {
  const subject = String(emailRow.subject || "");
  const body = String(emailRow.raw_body || "");
  const from = String(emailRow.from_email || "");

  const hay = `${from}\n${subject}\n${body}`.toLowerCase();

  // Marketing blockers: do NOT let discounts become Offer
  const marketingHits = [
    "unsubscribe",
    "view in browser",
    "bonus points",
    "rewards",
    "coupon",
    "promo code",
    "percent off",
    "sale",
    "deal",
    "limited time",
    "tickets",
    "ticket offer",
    "membership",
    "newsletter",
    "order #",
    "shipped",
    "reservation",
  ];
  const looksMarketing = marketingHits.some((k) => hay.includes(k));
  if (looksMarketing) return "Applied";

  // Denied / rejected
  if (
    hay.includes("rejected") ||
    hay.includes("not selected") ||
    hay.includes("we will not be moving forward") ||
    hay.includes("declined") ||
    hay.includes("unsuccessful") ||
    hay.includes("regret to inform")
  ) {
    return "Denied";
  }

  // Offer — require job context
  const hasOfferWord = hay.includes("offer");
  const hasJobContext =
    hay.includes("job offer") ||
    hay.includes("offer letter") ||
    hay.includes("employment offer") ||
    hay.includes("compensation") ||
    hay.includes("start date") ||
    hay.includes("background check") ||
    hay.includes("candidate") ||
    hay.includes("position") ||
    hay.includes("role") ||
    hay.includes("application");

  if (
    (hasOfferWord && hasJobContext) ||
    hay.includes("we are pleased to offer") ||
    hay.includes("we are excited to offer")
  ) {
    return "Offer";
  }

  // Interview
  if (
    hay.includes("interview") ||
    hay.includes("phone screen") ||
    hay.includes("technical screen") ||
    hay.includes("onsite") ||
    hay.includes("on-site")
  ) {
    return "Interview";
  }

  return "Applied";
}

function cleanUrl(u) {
  if (!u) return null;
  // Trim common trailing punctuation that emails wrap around links
  let s = String(u).trim().replace(/[)\],.!?;:'"]+$/g, "");
  // Strip angle-brackets
  s = s.replace(/^<+|>+$/g, "");
  // Basic sanity
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    // Normalize (also validates)
    return new URL(s).toString();
  } catch {
    return null;
  }
}

function extractUrls(text) {
  const raw = String(text || "");
  const hits = raw.match(/https?:\/\/[^\s<>"']+/gi) || [];
  const cleaned = hits.map(cleanUrl).filter(Boolean);

  // Dedupe while preserving order
  const seen = new Set();
  const out = [];
  for (const u of cleaned) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function meetingProvider(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();

    if (host.includes("meet.google.com")) return "google_meet";
    if (host.includes("zoom.us") || host.endsWith(".zoom.us")) return "zoom";
    if (host.includes("teams.microsoft.com")) return "teams";
    if (host.includes("webex.com") || host.endsWith(".webex.com")) return "webex";
    if (host.includes("calendar.google.com")) return "google_calendar";
    if (host.includes("outlook.office.com") || host.includes("outlook.live.com")) return "outlook_calendar";
    return "other";
  } catch {
    return "other";
  }
}

function isJunkUrl(url) {
  const u = String(url || "").toLowerCase();
  return (
    u.includes("unsubscribe") ||
    u.includes("email-preferences") ||
    u.includes("utm_") ||
    u.includes("trk=") ||
    u.includes("tracking") ||
    u.includes("doubleclick") ||
    u.includes("click") ||
    u.includes("safeunsubscribe")
  );
}

function pickBestMeetingUrl(urls) {
  // Prefer actual meeting joins over calendar pages
  const rank = (url) => {
    const p = meetingProvider(url);
    if (p === "google_meet") return 100;
    if (p === "zoom") return 95;
    if (p === "teams") return 90;
    if (p === "webex") return 85;
    if (p === "google_calendar") return 60;
    if (p === "outlook_calendar") return 55;
    return 10;
  };

  let best = null;
  let bestScore = -1;

  for (const url of urls) {
    if (!url || isJunkUrl(url)) continue;
    const score = rank(url);
    if (score > bestScore) {
      bestScore = score;
      best = url;
    }
  }

  return best;
}

function extractMeetingInvite(emailRow) {
  const text = `${emailRow.raw_body || ""}\n${emailRow.subject || ""}`;
  const urls = extractUrls(text);
  if (!urls.length) return null;

  // Only consider known meeting/calendar surfaces + a fallback “other”
  const candidates = urls.filter((u) =>
    /meet\.google\.com|zoom\.us|teams\.microsoft\.com|webex\.com|calendar\.google\.com|outlook\.(office|live)\.com/i.test(u)
  );

  const best = pickBestMeetingUrl(candidates.length ? candidates : urls);
  if (!best) return null;

  return { url: best, provider: meetingProvider(best) };
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}
function nowIso() {
  return new Date().toISOString();
}

function toTimeMs(v) {
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
}

// Decide whether we should promote interview metadata to applications table.
function shouldPromoteInterview(app, inviteUrl, interviewAtIso) {
    if (app.next_interview_link && inviteUrl) {
    const cur = meetingRank(app.next_interview_link);
    const inc = meetingRank(inviteUrl);
    if (inc > cur) return true;
  }

  const existingAt = toTimeMs(app.next_interview_at);
  const incomingAt = toTimeMs(interviewAtIso);

  // If we have no existing metadata, promote
  if (!app.next_interview_link && inviteUrl) return true;
  if (!existingAt && incomingAt) return true;

  // If we have a time and incoming is earlier, promote (keep “next” interview)
  if (existingAt && incomingAt && incomingAt < existingAt) return true;

  // If we have a time but no link and incoming has link, promote link only
  if (existingAt && incomingAt && incomingAt === existingAt && !app.next_interview_link && inviteUrl) return true;

  return false;
}

function promoteApplicationFromEmailSignal(userId, applicationId, emailRow) {
  const uid = String(userId);

  const app = db.prepare(`
    SELECT id, status, role, company,
           next_interview_at, next_interview_link
    FROM applications
    WHERE id = ? AND user_id = ?
    LIMIT 1
  `).get(String(applicationId), uid);

  if (!app) return { changed: false, reason: "app_not_found" };

  // terminal
  if (norm(app.status).includes("denied") || norm(app.status).includes("rejected")) {
    return { changed: false, reason: "terminal_denied" };
  }

  const inferredStatus = classifyStatusFromEmail(emailRow);
  const curRank = statusRank(app.status);
  const nextRank = statusRank(inferredStatus);

  const updates = {};
  let changed = false;

  // status monotonic
  let statusPromoted = false;
  let prevStatusForEvent = app.status;

  if (nextRank > curRank) {
    updates.status = inferredStatus;
    changed = true;
    statusPromoted = true;
  }

  // role normalization (safe)
  const normalizedRole = normalizeRoleFromEmail({
    subject: emailRow.subject,
    company: app.company,
    fallbackRole: app.role,
  });

  if (normalizedRole && normalizedRole !== app.role) {
    updates.role = normalizedRole;
    changed = true;
  }

  // interview metadata (deterministic)
  // - derive from best meeting/calendar URL
  // - keep earliest upcoming interview as "next"
  const invite = extractMeetingInvite(emailRow);
  if (invite?.url) {
    let interviewAt = extractInterviewTime(invite.url);
    if (!interviewAt) {
      interviewAt = extractInterviewAtFromEmailText(emailRow.raw_body || "");
    }

    if (shouldPromoteInterview(app, invite.url, interviewAt)) {
      // Always promote link/source/email-id when we accept a better invite
      updates.next_interview_link = invite.url;
      updates.next_interview_source = invite.provider;
      updates.next_interview_email_id = emailRow.id;

      // Promote time if we have it, or keep existing if we don't
      if (interviewAt) {
        updates.next_interview_at = interviewAt;
      }

      // If email language indicates Interview, allow status to move up (still monotonic)
      // (But do not force status if email doesn't classify as interview.)
      if (statusRank("Interview") > statusRank(updates.status || app.status)) {
        // Only bump if classifier already inferred Interview (avoid false positives)
        if (inferredStatus === "Interview" && statusRank("Interview") > curRank) {
          updates.status = "Interview";
          statusPromoted = true;
          prevStatusForEvent = app.status;
        }
      }

      changed = true;
    }
  }

  if (!changed) return { changed: false, reason: "no_promotion" };

  updates.updated_at = new Date().toISOString();

  const setSql = Object.keys(updates)
    .map((k) => `${k} = @${k}`)
    .join(", ");

  db.prepare(`UPDATE applications SET ${setSql} WHERE id = @id AND user_id = @user_id`).run({
    ...updates,
    id: String(applicationId),
    user_id: uid,
  });

  if (statusPromoted) {
    const payload = {
      statusChanged: true,
      prevStatus: prevStatusForEvent,
      nextStatus: updates.status,
      emailId: emailRow.id,
      signal: {
        source: "email",
        classifier: "classifyStatusFromEmail",
        inferredStatus: updates.status,
      },
      reason: `Email language indicates status moved to ${updates.status}.`,
    };

    db.prepare(`
      INSERT INTO application_events (
        id, user_id, application_id, event_type,
        prev_signal_mark, next_signal_mark, drift_detected,
        checked_at, created_at, payload, source
      ) VALUES (
        ?, ?, ?, 'email_status_promoted',
        NULL, NULL, 0,
        NULL, ?, ?, ?
      )
    `).run(
      newId(),
      uid,
      String(applicationId),
      nowIso(),
      JSON.stringify(payload),
      emailRow.source || "gmail"
    );
  }

  return { changed: true, nextStatus: updates.status || app.status };
}

module.exports = { promoteApplicationFromEmailSignal };
