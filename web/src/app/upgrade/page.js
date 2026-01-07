"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import AppShell from "../../components/AppShell";

{!demoMode && (
  <div
    style={{
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      border: "1px solid rgba(0,0,0,0.12)",
      background: "rgba(0,0,0,0.04)",
    }}
  >
    Free plan: 1 tracked job application.{" "}
    <Link href="/upgrade">Upgrade to keep tracking</Link>.
  </div>
)}

export default function UpgradePage() {
  const router = useRouter();

  function startTrial() {
    try {
      localStorage.setItem("jp_trial_active", "true");
      localStorage.setItem("jp_trial_started_at", String(Date.now()));
    } catch {}
    router.push("/job-applications");
  }

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
              <div className="jp-card__title jp-h2">No-sweat trial</div>
              <div className="jp-card__subtitle">
                Try monitoring with a fuller dashboard. Upgrade later when you’re confident.
              </div>

              <div className="jp-stack jp-mt-4">
                <div className="jp-muted">Trial includes:</div>
                <ul className="jp-muted" style={{ paddingLeft: 18 }}>
                  <li>Unlock up to 5 job applications (testing mode)</li>
                  <li>Status-change alerts</li>
                  <li>Background monitoring preview</li>
                </ul>

                <div className="jp-muted jp-mt-3">
                  Billing and checkout will be wired in a later phase.
                </div>

                <div className="jp-row jp-mt-4">
                  <button className="jp-btn jp-btn--primary" type="button" onClick={startTrial}>
                    Start trial
                  </button>

                  <span className="jp-spacer" />

                  <Link className="jp-btn jp-btn--ghost" href="/job-applications">
                    Not now
                  </Link>
                </div>

                <div className="jp-muted jp-mt-3">
                  This is frictionless by design: no card required during the build phase.
                </div>
              </div>
            </div>
          </div>

          <div className="jp-muted">
            When checkout is enabled, “Start trial” will transition into real plan selection.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
