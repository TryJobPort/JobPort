import Link from "next/link";

export default function InlineNotice({
  tone = "warn",
  title,
  message,
  ctaLabel,
  ctaHref,
}) {
  return (
    <div className={`jp-card jp-card--${tone}`}>
      <div className="jp-card__header">
        <div className="jp-row">
          <div className="jp-grow">
            <div className="jp-card__title">{title}</div>
            <div className="jp-card__subtitle">{message}</div>
          </div>

          {ctaHref ? (
            <Link className="jp-btn jp-btn--primary" href={ctaHref}>
              {ctaLabel || "Upgrade"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
