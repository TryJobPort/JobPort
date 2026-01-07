import React from "react";
import Link from "next/link";

export default function EmptyState({ title, subtitle, primaryHref, primaryLabel, secondaryHref, secondaryLabel }) {
  return (
    <div className="jp-empty">
      <div className="jp-empty__art" aria-hidden />
      <div className="jp-empty__title">{title}</div>
      {subtitle ? <div className="jp-empty__subtitle">{subtitle}</div> : null}

      <div className="jp-empty__actions">
        {primaryHref ? (
          <Link className="jp-btn jp-btn--primary" href={primaryHref}>
            {primaryLabel || "Get started"}
          </Link>
        ) : null}

        {secondaryHref ? (
          <Link className="jp-btn jp-btn--ghost" href={secondaryHref}>
            {secondaryLabel || "Learn more"}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
