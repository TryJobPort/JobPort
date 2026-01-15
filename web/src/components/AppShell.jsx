"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

async function logout() {
  await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/";
}

function initialsFrom(nameOrEmail = "") {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (s.includes("@")) return s[0].toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default function AppShell({ cta, children }) {
  const router = useRouter();
  const [identity, setIdentity] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Fetch identity (noop if not authed)
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/me`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.email || d?.name) setIdentity(d);
      })
      .catch(() => {});
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function onDoc(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const authed = Boolean(identity);
  const initials = useMemo(
    () => initialsFrom(identity?.name || identity?.email),
    [identity]
  );

  return (
    <div className="jp-shell">
      {/* Top bar */}
      <header className="jp-topbar">
        <div className="jp-topbar__inner">
          <div className="jp-topbar__left">
            <div
              className="jp-logo"
              onClick={() => router.push(authed ? "/dashboard" : "/")}
              role="button"
            >
              <span className="jp-logo__word">JobPort</span>
            </div>
          </div>

          <div className="jp-topbar__right" ref={menuRef}>
            {authed && cta ? <div className="jp-topbar__cta">{cta}</div> : null}

            {!authed ? (
              <>
                <button
                  className="jp-link"
                  type="button"
                  onClick={() => router.push("/login")}
                >
                  Log in
                </button>
                <button
                  className="jp-btn jp-btn--primary"
                  type="button"
                  onClick={() => router.push("/plans")}
                >
                  Get started
                </button>
              </>
            ) : (
              <>
                <button
                  className="jp-avatar"
                  type="button"
                  aria-label="Account"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  {initials}
                </button>

                {menuOpen && (
                  <div className="jp-menu">
                    <button
                      className="jp-menu-item"
                      type="button"
                      onClick={() => router.push("/account")}
                    >
                      Account
                    </button>
                    <button
                      className="jp-menu-item"
                      type="button"
                      onClick={() => router.push("/billing")}
                    >
                      Billing
                    </button>
                    <div className="jp-menu-sep" />
                    <button
                      className="jp-menu-item"
                      type="button"
                      onClick={logout}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content — DO NOT TOUCH LAYOUT */}
      {children}

      {/* Footer */}
      <footer className="jp-footer">
        <div className="jp-footer-inner">
          <div className="jp-footer-left">
            © JobPort 2026
          </div>

          <div className="jp-footer-right">
            <a href="/privacy">Privacy</a>
              <span className="jp-footer-sep">•</span>
              <a href="/terms">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
