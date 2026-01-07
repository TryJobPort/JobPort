import React from "react";
import {
  APPLICATION_STATUS,
  getApplicationStatusLabel,
} from "../lib/contracts";

/**
 * StatusBadge
 * - Semantic badge for job application status
 * - Uses token classes: jp-badge--info|warn|critical
 */
export default function StatusBadge({ status }) {
  const normalized = status || APPLICATION_STATUS.APPLIED;
  const label = getApplicationStatusLabel(normalized);

  const toneClass = getToneClass(normalized);

  return <span className={`jp-badge ${toneClass}`}>{label}</span>;
}

function getToneClass(status) {
  switch (status) {
    case APPLICATION_STATUS.APPLIED:
      return "jp-badge--info";

    case APPLICATION_STATUS.UNDER_REVIEW:
    case APPLICATION_STATUS.INTERVIEW:
      return "jp-badge--warn";

    case APPLICATION_STATUS.OFFER:
      return "jp-badge--info";

    case APPLICATION_STATUS.REJECTED:
      return "jp-badge--critical";

    default:
      return "jp-badge--info";
  }
}
