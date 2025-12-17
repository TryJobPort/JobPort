import React from "react";

export default function WelcomeCard({ onDismiss }) {
  return (
    <div className="jp-card">
      <div className="jp-card__header">
        <div className="jp-card__title">Welcome to JobPort</div>
        <div className="jp-card__subtitle">
          We monitor your job application pages and alert you only when something
          meaningful changes.
        </div>

        <div className="jp-stack jp-mt-4 jp-gap-2">
          <div className="jp-muted">
            • Alerts trigger on status changes or meaningful page updates
          </div>
          <div className="jp-muted">
            • No alert means nothing changed — you’re still being monitored
          </div>
        </div>

        <div className="jp-row jp-mt-4 jp-gap-2">
          <button className="jp-btn" onClick={onDismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
