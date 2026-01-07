"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavItem from "./NavItem";

async function logout() {
  await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/";
}

export default function AppShell({
  active = "applications",
  title,
  cta,
  children,
}) {
  const router = useRouter();
  const [trialActive, setTrialActive] = useState(false);

  useEffect(() => {
    try {
      const importMode = localStorage.getItem("jp_import_mode");
      const trialFlag = localStorage.getItem("jp_trial_active");
      setTrialActive(importMode === "mock" || trialFlag === "true");
    } catch {
      setTrialActive(false);
    }
  }, []);

  return (
    <div className="jp-shell">
      <header className="jp-topbar">
        <div className="jp-topbar__inner">
          <div className="jp-topbar__left">
            <button
              className="jp-icon-btn"
              aria-label="Menu"
              type="button"
            >
              ≡
            </button>

            <div className="jp-logo">
              <div className="jp-logo__mark" />
              <div className="jp-logo__word">JobPort</div>
            </div>
          </div>

          <div className="jp-topbar__right">
            {trialActive && (
              <span className="jp-badge jp-badge--muted">
                Trial active
              </span>
            )}

            <button
              onClick={logout}
              className="jp-text-btn"
              type="button"
            >
              Log out
            </button>

            <div className="jp-avatar" aria-label="Account" />
          </div>
        </div>
      </header>

      <div className="jp-body">
        <aside className="jp-sidenav">
          <NavItem
            label="Job applications"
            state={active === "applications" ? "active" : "default"}
            onClick={() => router.push("/job-applications")}
          />
          <NavItem
            label="Alerts"
            state={active === "alerts" ? "active" : "default"}
            onClick={() => router.push("/alerts")}
          />
        </aside>

        <section className="jp-content">
          <div className="jp-content__header">
            <h1 className="jp-h1">{title}</h1>
            {cta ? <div className="jp-content__cta">{cta}</div> : null}
          </div>

          <div className="jp-content__body">{children}</div>
        </section>
      </div>
    </div>
  );
}
