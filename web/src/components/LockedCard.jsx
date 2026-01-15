"use client";

import { isPro } from "../lib/plan";

export default function LockedCard({ title, subtitle, children }) {
  const pro = isPro();

  return (
    <div className={`jp-card ${!pro ? "jp-card--locked" : ""}`}>
      <div className="jp-card__header">
        <div className="jp-card__title">{title}</div>
        {subtitle ? <div className="jp-card__subtitle">{subtitle}</div> : null}
      </div>

      <div className="jp-card__body">
        {children}
      </div>

      {!pro && (
        <div className="jp-card__lock">
          <div className="jp-card__lockText">Upgrade to unlock</div>
        </div>
      )}
    </div>
  );
}
