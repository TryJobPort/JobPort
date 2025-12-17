import React from "react";
import StatusBadge from "./StatusBadge";

/**
 * ApplicationRow (Phase 6.3.1 polish)
 * - Locked rows feel like a premium preview (not broken)
 * - Hover overlay appears ONLY when locked
 * - Entire row click routes to upgrade when locked
 */
export default function ApplicationRow({
  company,
  role,
  status,
  lastCheckedAt,
  health, // reserved
  onClick,
  locked = false,
  onUpgrade,
  lockTitle = "Unlock this job application",
  lockSubtitle = "Upgrade to view history, alerts, and monitoring.",
  lockCtaLabel = "Upgrade",
}) {
  function handleClick(e) {
    if (locked) {
      e.preventDefault();
      e.stopPropagation();
      onUpgrade?.();
      return;
    }
    onClick?.();
  }

  return (
    <div
      className={[
        "jp-app-row",
        locked ? "jp-app-row--locked" : "jp-app-row--unlocked",
      ].join(" ")}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        handleClick(e);
      }}
      aria-disabled={locked ? "true" : "false"}
    >
      <div className="jp-app-row__content">
        <div className="jp-app-row__left">
          <div className="jp-app-row__company">{company}</div>
          <div className="jp-app-row__role">{role}</div>
        </div>

        <div className="jp-app-row__right">
          <div className="jp-app-row__status">
            <StatusBadge status={status} />
          </div>

          <div className="jp-app-row__last-checked">
            {lastCheckedAt ? formatDate(lastCheckedAt) : "—"}
          </div>
        </div>
      </div>

      {locked ? (
        <div className="jp-app-row__overlay" aria-hidden="true">
          <div className="jp-app-row__overlay-card">
            <div className="jp-app-row__overlay-title">{lockTitle}</div>
            <div className="jp-app-row__overlay-sub">{lockSubtitle}</div>
            <button
              className="jp-btn jp-btn--primary"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUpgrade?.();
              }}
            >
              {lockCtaLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -----------------------------
 * Helpers
 * ----------------------------- */

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
