import React from "react";

export default function AlertRow({
  company,
  role,
  severity = "info", // "info" | "warn" | "critical"
  title,
  message,
  detectedAtLabel,
  primaryAction, // { label, href }
  secondaryAction, // { label, href }
  onClear,
  clearing = false,
  isDemo = false,
}) {
  const sev = severity || "info";

  function onKeyDown(e) {
    if (e.key !== "Enter") return;
    
    // If focus is inside an interactive element, do nothing here.
    const el = e.target?.closest ? e.target.closest("a,button,input,textarea,select") : null;
    const tag = el?.tagName ? String(el.tagName).toLowerCase() : "";
    const isInteractive =
      tag === "a" || tag === "button" || tag === "input" || tag === "textarea" || tag === "select";
    if (isInteractive) return;

    if (primaryAction?.href) {
        window.open(primaryAction.href, "_blank", "noreferrer");
    }    
  }

  function onClick(e) {
    // If user is selecting text, do nothing
    const sel = window.getSelection?.();
    if (sel && String(sel).trim().length > 0) return;

    // Ignore clicks on interactive children
    const el = e.target;
    if (el) return;

    if (primaryAction?.href) {
      window.open(primaryAction.href, "_blank", "noreferrer");
    }
  }


  return (
    <div
      className={`jp-alert-row jp-alert-row--${sev}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <div className="jp-alert-row__bar" aria-hidden="true" />

      <div className="jp-alert-row__main">
        <div className="jp-alert-row__top">
          <div className="jp-alert-row__who">
            <span className="jp-alert-row__dot" aria-hidden="true" />

            <div className="jp-alert-row__identity">
              <span className="jp-alert-row__company">{company}</span>
              {isDemo ? (
                <span className="jp-badge jp-badge--demo">Demo</span>
              ) : null}
              <span className="jp-alert-row__sep">—</span>
              <span className="jp-alert-row__role">{role}</span>
            </div>
          </div>

          <div className="jp-alert-row__right">
            {detectedAtLabel ? (
              <div className="jp-alert-row__meta">{detectedAtLabel}</div>
            ) : null}

            <div className="jp-alert-row__actions">
              {primaryAction?.href ? (
                <a
                  className="jp-btn jp-btn--primary"
                  href={primaryAction.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {primaryAction.label || "Open"}
                </a>
              ) : null}

              {secondaryAction?.href ? (
                <a className="jp-btn jp-btn--ghost" href={secondaryAction.href}>
                  {secondaryAction.label || "View"}
                </a>
              ) : null}

              <button
                type="button"
                className="jp-btn jp-btn--ghost"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Clear alerts for this job application? This can’t be undone."
                    )
                  ) {
                    return;
                  }
                  onClear();
                }}
                disabled={clearing}
              >
                {clearing ? "Clearing…" : "Clear"}
              </button>
            </div>
          </div>
        </div>

        <div className="jp-alert-row__content">
          <div className="jp-alert-row__title">{title || "Alert"}</div>
          {message ? (
            <div className="jp-alert-row__message">{message}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
