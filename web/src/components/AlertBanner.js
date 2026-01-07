export default function AlertBanner({ alert }) {
  if (!alert) return null;

  return (
    <div className="card" style={{ borderLeft: "6px solid var(--accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div className="h3">{alert.title}</div>
          <p className="muted" style={{ marginTop: 6 }}>
            {alert.message}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {alert?.secondaryAction?.onClick && (
            <button className="btn" type="button" onClick={alert.secondaryAction.onClick}>
              {alert.secondaryAction.label}
            </button>
          )}

          {alert?.primaryAction?.href && (
            <a className="btn" href={alert.primaryAction.href} target="_blank" rel="noreferrer">
              {alert.primaryAction.label}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
