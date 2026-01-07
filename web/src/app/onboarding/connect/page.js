"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "../../../components/AppShell";

export default function OnboardingConnectPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    try {
      const e = localStorage.getItem("jp_apply_email") || "";
      setEmail(e);
    } catch {}
  }, []);

  const masked = useMemo(() => {
    const e = String(email || "").trim();
    if (!e.includes("@")) return e || "—";
    const [user, domain] = e.split("@");
    if (!user) return e;
    const safeUser =
      user.length <= 2 ? `${user[0] || ""}*` : `${user[0]}***${user[user.length - 1]}`;
    return `${safeUser}@${domain}`;
  }, [email]);

  function continueToImport() {
    router.push("/onboarding/importing");
  }

  return (
    <AppShell title="Connect email">
      <div className="jp-page">
        <div className="jp-stack">
          <div className="jp-card">
            <div className="jp-card__header">
              <div className="jp-card__title">Email connection</div>
              <div className="jp-card__subtitle">
                We’ll support Google and Microsoft sign-in paths later. For now, we’ll simulate an import.
              </div>

              <div className="jp-mt-4">
                <div className="jp-muted">Using:</div>
                <div className="jp-row jp-mt-2" style={{ alignItems: "center" }}>
                  <span className="jp-badge">{masked || "—"}</span>
                  <span className="jp-spacer" />
                  <button className="jp-btn jp-btn--primary" type="button" onClick={continueToImport}>
                    Continue
                  </button>
                </div>

                <div className="jp-muted jp-mt-4">
                  Nothing is connected yet. This step is a preview of the flow.
                </div>
              </div>
            </div>
          </div>

          <div className="jp-muted">
            Next: we’ll build your dashboard and lock most job applications as a free-plan preview.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
