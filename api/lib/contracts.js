/**
 * JobPort — UI Contracts
 * Single source of truth for enums + UI-facing domain mappings.
 * Used by screens and components.
 */

/* -----------------------------
 * Application Status
 * ----------------------------- */

export const APPLICATION_STATUS = {
  APPLIED: "applied",
  UNDER_REVIEW: "under_review",
  INTERVIEW: "interview",
  OFFER: "offer",
  REJECTED: "rejected",
};

/**
 * Display labels for StatusBadge
 * UI derives labels from status — never passed manually
 */
export const APPLICATION_STATUS_LABELS = {
  [APPLICATION_STATUS.APPLIED]: "Applied",
  [APPLICATION_STATUS.UNDER_REVIEW]: "Under review",
  [APPLICATION_STATUS.INTERVIEW]: "Interview",
  [APPLICATION_STATUS.OFFER]: "Offer",
  [APPLICATION_STATUS.REJECTED]: "Rejected",
};

/* -----------------------------
 * Application Health
 * ----------------------------- */

export const APPLICATION_HEALTH = {
  HEALTHY: "healthy",
  STALE: "stale",
  ERROR: "error",
};

/* -----------------------------
 * Alert Severity
 * ----------------------------- */

export const ALERT_SEVERITY = {
  INFO: "info",
  WARN: "warn",
  CRITICAL: "critical",
};

/* -----------------------------
 * Nav Item State
 * ----------------------------- */

export const NAV_ITEM_STATE = {
  DEFAULT: "default",
  ACTIVE: "active",
  DISABLED: "disabled",
};

/* -----------------------------
 * Utilities (Optional, Pure)
 * ----------------------------- */

/**
 * Safe label resolver for application status
 */
export function getApplicationStatusLabel(status) {
  return APPLICATION_STATUS_LABELS[status] ?? "Unknown";
}
