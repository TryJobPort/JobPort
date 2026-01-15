"use client";

import React, { useMemo, useState } from "react";
import AppShell from "../../../components/AppShell";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export default function OnboardingConnectPage() {
  const [starting, setStarting] = useState(false);

  const oauthUrl = useMemo(() => `${API_BASE}/auth/google/start`, []);

  function startGoogle() {
    setStarting(true);
    window.location.href = oauthUrl; // API callback redirects to /importing
  }

  return (
    <AppShell title="Connect Gmail">
      <div className="jp-page">
        <div className="jp-stack">
          <div className="jp-card">
            <div className="jp-card__header">
              <div className="jp-card__title">Connect Gmail</div>
              <div className="jp-card__subtitle">
                JobPort reads job signals from your inbox to build your job pipeline automatically.
                Read-only. No sending. No modifying.
              </div>
            </div>

            <div style={{ padding: "0 18px 18px" }}>
              <button
                className="jp-btn jp-btn--primary"
                type="button"
                onClick={startGoogle}
                disabled={starting}
              >
                {starting ? "Opening Google…" : "Continue with Google"}
              </button>

              <div className="jp-muted" style={{ marginTop: 10 }}>
                You’ll be redirected back and we’ll start importing immediately.
              </div>
            </div>
          </div>

          <div className="jp-muted">
            Tip: Once Gmail is connected, you shouldn’t have to manually create job applications.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
