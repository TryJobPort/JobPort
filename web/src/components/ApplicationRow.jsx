"use client";

import React, { useMemo } from "react";
import StatusBadge from "./StatusBadge";

export default function ApplicationRow({
  company,
  role,
  status,
  lastCheckedAt,
  health, // reserved
  locked = false,
  monitoringState, // "on" | "off"
  onUpgrade,
  onClick,
}) {
  const lastCheckedLabel = useMemo(() => {
    if (!lastCheckedAt) return "Last scanned: —";
    try {
      return `Last scanned: ${new Date(lastCheckedAt).toLocaleString()}`;
    } catch {
      return "Last scanned: —";
    }
  }, [lastCheckedAt]);

  const isImported =
    typeof window !== "undefined" &&
    localStorage.getItem("jp_import_mode") === "mock";

  function handleRowClick(e) {
    if (locked) {
      e.preventDefault();
      e.stopPropagation();
      onUpgrade?.();
      return;
    }
    onClick?.();
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleRowClick(e);
  }

  return (
    <div
      className={`jp-app-row ${locked ? "jp-app-row--locked" : ""}`}
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      aria-label={
        locked
          ? `Locked premium preview for ${company} ${role}. Upgrade to unlock.`
          : `Open job application for ${company} ${role}.`
      }
    >
      <div className="jp-app-row__content">
        <div className="jp-app-row__left">
          <div className="jp-app-row__company">
            {company || "—"}

            {locked ? (
              <span className="jp-badge jp-badge--muted" style={{ marginLeft: 8 }}>
                Locked
              </span>
            ) : null}

            {monitoringState === "on" && !locked ? (
              <span className="jp-badge" style={{ marginLeft: 8 }}>
                Monitoring on
              </span>
            ) : null}

            {isImported ? (
              <span
                className="jp-badge jp-badge--muted"
                style={{ marginLeft: 8 }}
              >
                Imported (email)
              </span>
            ) : null}
          </div>

          <div className="jp-app-row__role">{role || "—"}</div>

          <div className="jp-faint" style={{ marginTop: 4 }}>
            {lastCheckedLabel}
          </div>
        </div>

        <div className="jp-app-row__right">
          <StatusBadge status={status} />
        </div>
      </div>

      {locked ? (
        <div
          className="jp-app-row__overlay"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="jp-app-row__overlay-card">
            <div className="jp-app-row__overlay-title">Free plan preview</div>
            <div className="jp-app-row__overlay-sub">
              Unlock monitoring and alerts for this job application.
            </div>
            <button
              type="button"
              className="jp-btn jp-btn--primary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUpgrade?.();
              }}
            >
              Upgrade
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
