"use client";

import AppShell from "@/components/AppShell";
import AlertBanner from "@/components/AlertBanner";
import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export default function OnboardingPage() {
  const connectHref = `${API_BASE}/auth/google/start`;

  return (
    <AppShell title="Get started">
      <main className="jp-page">
        <div className="jp-onboard-wrap">
          <div className="jp-onboard-card">
            <div className="jp-onboard-kicker">WELCOME</div>

            <h1 className="jp-onboard-title">
              JobPort builds your job pipeline from inbox signals
            </h1>

            <p className="jp-onboard-sub">
              We detect job applications, interviews, and follow-ups and turn them into a
              trustworthy dashboard. You stay in control.
            </p>

            <ul className="jp-onboard-list">
              <li>We read signals, not everything</li>
              <li>We never send email or modify your inbox</li>
              <li>Your dashboard becomes your system of record</li>
            </ul>

            <a href={connectHref} className="jp-google-btn jp-onboard-cta">
              <span className="jp-google-icon" aria-hidden />
              <span className="jp-google-text">Continue with Google</span>
            </a>

            <p className="jp-onboard-fine">
              Read-only Gmail access. We don’t send email or modify your inbox.
            </p>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
