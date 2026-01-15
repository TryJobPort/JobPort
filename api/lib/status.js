// api/lib/status.js

const CANONICAL = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Under Review",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

function normalizeJobApplicationStatus(input) {
  if (!input) return CANONICAL.APPLIED;

  const s = String(input).trim().toLowerCase();

  if (["unknown", "n/a", "na", "none", "-"].includes(s)) {
    return CANONICAL.APPLIED;
  }

  if (s === "applied" || s === "application submitted") {
    return CANONICAL.APPLIED;
  }

  if (
    s === "under review" ||
    s === "under_review" ||
    s === "under-review" ||
    s === "review" ||
    s === "in review" ||
    s === "in_review" ||
    s === "in process" ||
    s === "in consideration" ||
    s === "in_consideration"
  ) {
    return CANONICAL.UNDER_REVIEW;
  }

  if (
    s === "interview" ||
    s === "interviewing" ||
    s === "phone screen" ||
    s === "phone_screen" ||
    s === "screen" ||
    s === "onsite" ||
    s === "on-site"
  ) {
    return CANONICAL.INTERVIEW;
  }

  if (s === "offer" || s === "offered") {
    return CANONICAL.OFFER;
  }

  if (
    s === "rejected" ||
    s === "declined" ||
    s === "not selected" ||
    s === "no longer under consideration" ||
    s === "closed"
  ) {
    return CANONICAL.REJECTED;
  }

  return CANONICAL.APPLIED;
}

module.exports = {
  CANONICAL_JOB_APPLICATION_STATUS: CANONICAL,
  normalizeJobApplicationStatus,
};
