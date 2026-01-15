// api/services/jobSignalFilter.js
//
// Goal: identify REAL job-application emails (ATS / recruiter / application lifecycle)
// and reject marketing "offers" (Hilton points, Ticketmaster, etc.)
//
// Exports:
// - scoreJobSignal(emailRow) -> { score, reasons, portalGuess }
// - isJobSignalEmail(emailRow) -> boolean (uses score + thresholds)
// - deriveAppFromEmail(emailRow) -> { company, role, portal, status }

const { normalizeCompanyFromEmail } = require("./companyNormalize");
const { normalizeRoleFromEmail } = require("./roleNormalize");

const ATS_HINTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workday",
  "myworkday",
  "icims.com",
  "smartrecruiters.com",
  "jobvite.com",
  "successfactors",
  "taleo.net",
  "oraclecloud",
];

const JOB_INTENT_TERMS = [
  "your application",
  "application received",
  "thank you for applying",
  "candidate",
  "recruiter",
  "talent acquisition",
  "hiring team",
  "position",
  "role",
  "job offer",
  "offer letter",
  "employment offer",
  "background check",
  "start date",
  "interview",
  "phone screen",
  "onsite",
  "on-site",
  "technical screen",
  "schedule your interview",
];

const MARKETING_TERMS = [
  "unsubscribe",
  "view in browser",
  "bonus points",
  "rewards",
  "membership",
  "coupon",
  "promo code",
  "percent off",
  "sale",
  "deal",
  "limited time",
  "ends tonight",
  "sweepstakes",
  "tickets",
  "ticket offer",
  "family 4 pack",
  "order #",
  "shipped",
  "delivery",
  "reservation",
];

function norm(s) {
  return String(s || "").toLowerCase();
}

function cleanEmail(addr) {
  const s = String(addr || "").trim();
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

function domainOfEmail(addr) {
  const e = cleanEmail(addr);
  const at = e.lastIndexOf("@");
  if (at === -1) return "";
  return e.slice(at + 1).toLowerCase();
}

function hasAtsHint(text) {
  const t = norm(text);
  return ATS_HINTS.some((h) => t.includes(h));
}

function hasJobIntent(text) {
  const t = norm(text);
  return JOB_INTENT_TERMS.some((k) => t.includes(k));
}

function looksMarketing(text) {
  const t = norm(text);
  return MARKETING_TERMS.some((k) => t.includes(k));
}

function addReason(add, reasons, score, pts, label) {
  score.value += pts;
  if (label) reasons.push(label);
}

function guessPortal(fromEmail, body, subject) {
  const hay = `${fromEmail}\n${subject}\n${body}`;
  if (hasAtsHint(hay)) return "ATS";
  return "Email";
}

/**
 * scoreJobSignal
 * - Marketing should not get a free pass because it contains the word "offer".
 * - "Offer" is only strong when paired with job context.
 */
function scoreJobSignal(emailRow) {
  const from = String(emailRow.from_email || "");
  const subject = String(emailRow.subject || "");
  const body = String(emailRow.raw_body || "");

  const hay = `${from}\n${subject}\n${body}`;
  const h = norm(hay);

  const reasons = [];
  const score = { value: 0 };

  const portalGuess = guessPortal(from, body, subject);

  // ATS presence is a strong positive
  if (portalGuess === "ATS") {
    addReason(null, reasons, score, 35, "ats_hint");
  }

  // Explicit interview in subject/body
  if (norm(subject).includes("interview")) addReason(null, reasons, score, 60, "subject_interview");
  if (h.includes("interview")) addReason(null, reasons, score, 30, "body_interview");

  // Meeting links are strong interview signals (covers HTML templates where "interview" may not be plain text)
  if (h.includes("meet.google.com/")) addReason(null, reasons, score, 70, "meet_link");
  if (h.includes("zoom.us/")) addReason(null, reasons, score, 70, "zoom_link");
  if (h.includes("teams.microsoft.com/")) addReason(null, reasons, score, 70, "teams_link");
  if (h.includes("webex.com/")) addReason(null, reasons, score, 70, "webex_link");

  // Light keyword boosts for common invite templates
  if (h.includes("google meet")) addReason(null, reasons, score, 25, "google_meet_phrase");
  if (h.includes("join zoom meeting")) addReason(null, reasons, score, 25, "join_zoom_phrase");
  if (h.includes("video call link")) addReason(null, reasons, score, 20, "video_call_link_phrase");

  // Application lifecycle
  if (h.includes("your application")) addReason(null, reasons, score, 35, "application_context");
  if (h.includes("thank you for applying") || h.includes("application received"))
    addReason(null, reasons, score, 35, "application_received");

  // Rejection
  if (
    h.includes("we will not be moving forward") ||
    h.includes("not selected") ||
    h.includes("regret to inform") ||
    h.includes("unsuccessful") ||
    h.includes("rejected")
  ) {
    addReason(null, reasons, score, 60, "body_rejection");
  }

  // Offer (MUST be job offer context)
  const hasOfferWord = h.includes("offer");
  const hasOfferContext =
    h.includes("job offer") ||
    h.includes("offer letter") ||
    h.includes("employment offer") ||
    h.includes("compensation") ||
    h.includes("start date") ||
    h.includes("background check") ||
    h.includes("candidate") ||
    h.includes("position") ||
    h.includes("role") ||
    h.includes("application");

  if (hasOfferWord && hasOfferContext) {
    addReason(null, reasons, score, 70, "offer_with_job_context");
  } else if (norm(subject).includes("offer") && hasOfferContext) {
    addReason(null, reasons, score, 55, "subject_offer_with_context");
  }

  // Light signal: noreply is not job intent; only a tiny bump
  if (norm(from).includes("noreply")) addReason(null, reasons, score, 5, "noreply_sender");

  // Marketing penalty: only apply when we DO NOT have job intent
  const jobIntent = hasJobIntent(hay) || hasAtsHint(hay);
  if (!jobIntent && looksMarketing(hay)) {
    addReason(null, reasons, score, -90, "marketing_penalty");
  }

  // clamp
  if (score.value < 0) score.value = 0;
  if (score.value > 100) score.value = 100;

  return { score: score.value, reasons, portalGuess };
}

function isJobSignalEmail(emailRow) {
  const ATTACH_MIN = Number(process.env.JP_ATTACH_MIN || 60);
  const { score, reasons } = scoreJobSignal(emailRow);

  // Hard reject: marketing penalty hit means no attach
  if (reasons.includes("marketing_penalty")) return false;

  return score >= ATTACH_MIN;
}

function deriveAppFromEmail(emailRow) {
  // If it passed isJobSignalEmail, we can create conservative app fields
  const company = normalizeCompanyFromEmail({
    from_email: emailRow.from_email,
    subject: emailRow.subject,
  });

  const role = normalizeRoleFromEmail({
    subject: emailRow.subject,
    company,
    fallbackRole: "Role",
  });

  // portal is only a label; true ATS matching comes later
  const { portalGuess } = scoreJobSignal(emailRow);
  const portal = portalGuess === "ATS" ? "ATS" : "Email";

  // Status is derived downstream (promoteFromEmailSignal)
  return { company: company || "Unknown", role: role || "Role", portal, status: "Applied" };
}

module.exports = { scoreJobSignal, isJobSignalEmail, deriveAppFromEmail };
