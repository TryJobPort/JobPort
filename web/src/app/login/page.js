"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AppShell from "../../components/AppShell";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export default function LoginPage() {
  const [err, setErr] = useState("");
  const googleHref = useMemo(() => `${API_BASE}/auth/google/start`, []);

  return (
    <AppShell>
      <main className="jp-page">
        <div className="jp-auth-wrap">
          <div className="jp-auth-card">
            <h1 className="jp-auth-title">Log in</h1>
            <p className="jp-auth-sub">
              Pick up where you left off. Your dashboard is your system of record.
            </p>

            {err ? <p className="jp-auth-err">{err}</p> : null}

            <a
              href={googleHref}
              onClick={() => setErr("")}
              className="jp-auth-google"
              aria-label="Continue with Google"
            >
              <span className="jp-google-icon" aria-hidden />
              <span className="jp-google-text">Continue with Google</span>
            </a>

            <p className="jp-auth-fine">
              Read-only Gmail access. We don’t send email or modify your inbox.
            </p>

            <div className="jp-auth-links">
              <Link href="/" className="jp-auth-link">
                ← Back
              </Link>
              <Link href="/signup" className="jp-auth-link">
                New here? Get started
              </Link>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
