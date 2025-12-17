"use client";

import Link from "next/link";
import AppShell from "../../components/AppShell";

export default function UpgradePage() {
  return (
    <AppShell
      active="upgrade"
      title="Upgrade"
      cta={
        <Link className="jp-btn jp-btn--ghost" href="/job-applications">
          Back to job applications
        </Link>
      }
    >
      <div className="jp-page">
        <div className="jp-stack">
          <div className="jp-card">
            <div className="jp-card__header">
              <div className="jp-card__title jp-h2">Go Pro</div>
              <div className="jp-card__subtitle">
                Monitor more job applications and get unlimited alerts.
              </div>

              <div className="jp-stack jp-mt-4">
                <div className="jp-muted">Pro includes:</div>
                <ul className="jp-muted" style={{ paddingLeft: 18 }}>
                  <li>Track unlimited job applications</li>
                  <li>Unlimited status-change alerts</li>
                  <li>Background monitoring (no manual scanning)</li>
                </ul>

                <div className="jp-muted jp-mt-3">
                  Billing and checkout will be wired in a later phase.
                </div>

                <div className="jp-row jp-mt-4">
                  <Link className="jp-btn jp-btn--primary" href="/job-applications">
                    Continue
                  </Link>
                  <span className="jp-spacer" />
                  <div className="jp-muted">Placeholder page (no paywall yet)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
