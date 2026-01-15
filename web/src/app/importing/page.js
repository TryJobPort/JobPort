"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function ImportingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const connected = String(searchParams.get("connected") || "");
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState("");

  const [tick, setTick] = useState(0);

  const pct = useMemo(() => {
    const inbound = Number(status?.emails_inserted || 0);
    const attached = Number(status?.emails_scanned || 0);
    const apps = Number(status?.applications_found || 0);

    // Simple confidence progress model (doesn't pretend to be exact)
    // 0–50%: inbound discovery
    // 50–85%: attachment happening
    // 85–100%: applications present
    let p = 0;

    if (inbound > 0) p = 20 + clamp(inbound, 0, 20) * 1.5; // up to ~50
    if (attached > 0) p = Math.max(p, 55 + clamp(attached, 0, 20) * 1.5); // up to ~85
    if (apps > 0) p = Math.max(p, 90);

    // cap 99 until we actually route
    return clamp(Math.round(p), 0, apps > 0 ? 100 : 99);
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    async function poll() {
      try {
        setErr("");
        const json = await apiFetch("/import/status");
        if (cancelled) return;

        setStatus(json);

        // As soon as we have real job applications, move to the wow moment
        if (Number(json?.applications_found || 0) > 0) {
          router.replace("/dashboard?welcome=1");
        }
      } catch (e) {
        if (cancelled) return;
        setErr(e.message || "Failed to fetch import status");
      } finally {
        if (!cancelled) setTick((t) => t + 1);
      }
    }

    poll();
    intervalId = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [router]);

  const inbound = Number(status?.emails_inserted || 0);
  const attached = Number(status?.emails_scanned || 0);
  const apps = Number(status?.applications_found || 0);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#fff",
      }}
    >
      <section
        style={{
          width: "min(920px, 100%)",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          background: "rgba(255,255,255,0.95)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 1.2,
            fontWeight: 800,
            opacity: 0.75,
          }}
        >
          IMPORTING
        </div>

        <h1 style={{ margin: "14px 0 10px", fontSize: 36, lineHeight: 1.08 }}>
          Building your pipeline…
        </h1>

        <p style={{ margin: 0, fontSize: 15, opacity: 0.82, maxWidth: 760 }}>
          We’re scanning for job application signals and attaching them to job applications.
          This usually takes under a minute on the first run.
        </p>

        {connected === "google" && (
          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
            Connected: <strong>Google</strong>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          {/* Progress bar */}
          <div
            style={{
              height: 12,
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: "rgba(30,64,175,0.35)",
                transition: "width 350ms ease",
              }}
            />
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              opacity: 0.8,
            }}
          >
            <span>{pct}%</span>
            <span>live</span>
          </div>
        </div>

        {/* Counters */}
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 16,
              padding: 14,
              background: "white",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
              EMAILS FOUND
            </div>
            <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900 }}>
              {inbound}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 16,
              padding: 14,
              background: "white",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
              EMAILS ATTACHED
            </div>
            <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900 }}>
              {attached}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 16,
              padding: 14,
              background: "white",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
              JOB APPLICATIONS
            </div>
            <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900 }}>
              {apps}
            </div>
          </div>
        </div>

        {/* Error / fallback */}
        {err && (
          <div
            style={{
              marginTop: 14,
              border: "1px solid rgba(220, 38, 38, 0.35)",
              borderRadius: 16,
              padding: 12,
              background: "rgba(220,38,38,0.06)",
            }}
          >
            <div style={{ fontWeight: 800, color: "crimson" }}>Import status unavailable</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
              {err}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  textDecoration: "none",
                  fontWeight: 700,
                  background: "white",
                }}
              >
                Go to funnel
              </Link>

              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Subtle footer */}
        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.65 }}>
          Poll tick: {tick}
        </div>
      </section>
    </main>
  );
}
