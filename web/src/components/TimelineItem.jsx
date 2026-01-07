import React from "react";

/**
 * TimelineItem
 * - Renders a single job application event in the timeline
 * - Supports status changes, page drift, and generic events
 * - Optimized for quick visual scanning
 */
export default function TimelineItem({
  eventType,
  statusChanged,
  driftDetected,
  prevStatus,
  nextStatus,
  checkedAt,
  source,
}) {
  const kind = statusChanged ? "status" : driftDetected ? "drift" : "info";

  const pillClass =
    kind === "status"
      ? "jp-timeline__pill jp-timeline__pill--status"
      : kind === "drift"
      ? "jp-timeline__pill jp-timeline__pill--drift"
      : "jp-timeline__pill";

  const title =
    kind === "status"
      ? "Status changed"
      : kind === "drift"
      ? "Page content changed"
      : "Activity detected";

  const subtitle =
    kind === "status"
      ? "Application status signal updated"
      : kind === "drift"
      ? "Job application page changed"
      : eventType || "Event recorded";

  return (
    <div className="jp-timeline">
      {/* Rail */}
      <div className="jp-timeline__rail" aria-hidden="true">
        <div className={`jp-timeline__dot jp-timeline__dot--${kind}`} />
        <div className="jp-timeline__line" />
      </div>

      {/* Card */}
      <div className="jp-timeline__card">
        <div className="jp-timeline__top">
          <div>
            <div className="jp-timeline__title">{title}</div>
            <div className="jp-timeline__subtitle">{subtitle}</div>
          </div>

          <span className={pillClass}>
            {kind === "status"
              ? "Status"
              : kind === "drift"
              ? "Page"
              : "Event"}
          </span>
        </div>

        {/* Status transition */}
        {statusChanged ? (
          <div className="jp-timeline__desc">
            <span className="jp-timeline__mono">
              {prevStatus || "UNKNOWN"}
            </span>
            <span className="jp-timeline__arrow">→</span>
            <span className="jp-timeline__mono">
              {nextStatus || "UNKNOWN"}
            </span>
          </div>
        ) : null}

        {/* Drift explanation */}
        {driftDetected && !statusChanged ? (
          <div className="jp-timeline__desc">
            The job application page changed since the last scan.
          </div>
        ) : null}

        {/* Meta */}
        <div className="jp-timeline__meta">
          <span>
            {checkedAt ? new Date(checkedAt).toLocaleString() : "—"}
          </span>
          {source ? <span>{` · ${source}`}</span> : null}
          {eventType ? <span>{` · ${eventType}`}</span> : null}
        </div>
      </div>
    </div>
  );
}
