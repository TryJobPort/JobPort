"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiFetch } from "../../lib/api";
import { useRequireAuth } from "../../lib/requireAuth";
import AlertBanner from "../../components/AlertBanner";

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatRelativeFromNow(date) {
  const ms = date.getTime() - Date.now();
  const absMs = Math.abs(ms);
  const mins = Math.round(absMs / 60000);

  if (mins < 60) return ms >= 0 ? `in ${mins}m` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return ms >= 0 ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return ms >= 0 ? `in ${days}d` : `${days}d ago`;
}

function stageBucket(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("offer")) return "Offer";
  if (s.includes("interview")) return "Interview";
  if (s.includes("denied") || s.includes("rejected") || s.includes("closed")) return "Denied";
  return "Applied";
}

// Local demo fallback (keeps list usable even if backend requires auth)
const DEMO_APPLICATIONS = [
  {
    id: "demo-1",
    company: "Acme Corp",
    role: "Product Manager",
    portal: "Greenhouse",
    status: "Applied",
    url: "https://example.com",
    last_bearing_at: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
  },
  {
    id: "demo-2",
    company: "Coinbase",
    role: "Director of Product",
    portal: "Coinbase",
    status: "Offer",
    url: "https://example.com",
    last_bearing_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
  {
    id: "demo-3",
    company: "Spotify",
    role: "Group Product Manager",
    portal: "Spotify Careers",
    status: "Interview",
    url: "https://example.com",
    last_bearing_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    next_interview_at: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    next_interview_link: "https://example.com",
    next_interview_email_id: null,
  },
  {
    id: "demo-4",
    company: "Meta",
    role: "Senior PM",
    portal: "Meta",
    status: "Denied",
    url: "https://example.com",
    last_bearing_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
];

export default function JobApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auth hook MUST be called unconditionally; do not return early before other hooks.
  const { loading: authLoading } = useRequireAuth({ redirectTo: "/login" });

  const stageParam = String(searchParams.get("stage") || "").trim();
  const activeStage =
    stageParam === "Applied" || stageParam === "Interview" || stageParam === "Offer" || stageParam === "Denied"
      ? stageParam
      : "";

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  const [scanningId, setScanningId] = useState("");
  const [scanErrById, setScanErrById] = useState({});
  const [scanResultById, setScanResultById] = useState({});

  async function load() {
    const json = await apiFetch("/applications");
    setData(json);
  }

  // Boot load (guarded while auth resolves)
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function boot() {
      try {
        setErr("");
        const json = await apiFetch("/applications");
        if (!cancelled) {
          setDemoMode(false);
          setData(json);
        }
      } catch (e) {
        if (!cancelled) {
          // Keep moving even if backend requires auth or is unavailable
          setDemoMode(true);
          setErr("");
          setData({ ok: true, applications: DEMO_APPLICATIONS });
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  const allApps = data?.applications || [];

  const filteredApps = useMemo(() => {
    if (!activeStage) return allApps;
    return allApps.filter((a) => stageBucket(a.status) === activeStage);
  }, [allApps, activeStage]);

  async function scanNow(appId) {
    try {
      setErr("");
      setScanningId(appId);

      setScanErrById((m) => ({ ...m, [appId]: "" }));
      setScanResultById((m) => ({ ...m, [appId]: null }));

      const result = await apiFetch(`/applications/${appId}/take-bearing`, {
        method: "POST",
      });

      setScanResultById((m) => ({
        ...m,
        [appId]: {
          checkedAt: result.checkedAt,
          driftDetected: !!result.driftDetected,
          alert: result.alert || null,
        },
      }));

      await load();
    } catch (e) {
      setScanErrById((m) => ({ ...m, [appId]: e.message }));
    } finally {
      setScanningId("");
    }
  }

  function clearFilter() {
    router.push("/job-applications");
  }

  // Safe: return null only AFTER all hooks are declared
  if (authLoading) return null;

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Job applications</h1>
        <Link href="/job-applications/funnel">Funnel</Link>
        <Link href="/job-applications/new">Track a job application</Link>
      </header>

      {demoMode && (
        <div
          style={{
            marginTop: 14,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 16,
            padding: 14,
            background: "white",
          }}
        >
          <strong>Demo mode</strong>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            This list is using a preview dataset. Option 2 will connect Google (read-only) to build this from your real inbox.
          </div>
        </div>
      )}

      {activeStage && (
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.95)",
              fontSize: 13,
            }}
          >
            Filtered: <strong>{activeStage}</strong> ({filteredApps.length})
          </span>

          <button
            type="button"
            onClick={clearFilter}
            style={{
              padding: "6px 10px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Clear filter
          </button>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {err && <p style={{ color: "crimson" }}>Error: {err}</p>}

        {!data && !err && <p>Loading…</p>}

        {filteredApps.length === 0 && data && (
          <p style={{ opacity: 0.8 }}>{activeStage ? `No job applications in “${activeStage}”.` : "No job applications tracked yet."}</p>
        )}

        {filteredApps.length > 0 && (
          <>
            <ul style={{ paddingLeft: 18 }}>
              {filteredApps.map((a) => {
                const scanning = scanningId === a.id;
                const scanErr = scanErrById[a.id];
                const scanRes = scanResultById[a.id];

                const interviewAt = safeDate(a.next_interview_at);
                const interviewIsUpcoming = !!interviewAt && interviewAt.getTime() > Date.now();
                const interviewRel = interviewAt ? formatRelativeFromNow(interviewAt) : "";

                return (
                  <li key={a.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div>
                          <strong>{a.company}</strong> — {a.role}
                        </div>

                        <div style={{ fontSize: 13, opacity: 0.8 }}>
                          Status: {a.status}
                          {a.portal ? ` · Portal: ${a.portal}` : ""}{" "}
                          {a.url ? (
                            <>
                              ·{" "}
                              <a href={a.url} target="_blank" rel="noreferrer">
                                Open
                              </a>
                            </>
                          ) : null}
                          {" · "}
                          <Link href={`/job-applications/${a.id}`}>View history</Link>
                        </div>

                        {interviewIsUpcoming && (
                          <div style={{ marginTop: 8 }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid rgba(0,0,0,0.12)",
                                fontSize: 12,
                                background: "rgba(255,255,255,0.7)",
                              }}
                            >
                              <strong style={{ fontWeight: 600 }}>Upcoming interview</strong>
                              <span style={{ opacity: 0.85 }}>
                                {interviewAt.toLocaleString()} ({interviewRel})
                              </span>
                            </span>

                            <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                              {a.next_interview_link && (
                                <a
                                  href={a.next_interview_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "6px 10px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(0,0,0,0.15)",
                                    textDecoration: "none",
                                  }}
                                >
                                  Join meeting
                                </a>
                              )}

                              {a.next_interview_email_id && (
                                <Link
                                  href={`/emails/${a.next_interview_email_id}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "6px 10px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(0,0,0,0.15)",
                                    textDecoration: "none",
                                  }}
                                >
                                  Open email
                                </Link>
                              )}
                            </div>
                          </div>
                        )}

                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                          {a.last_bearing_at ? `Last scanned: ${new Date(a.last_bearing_at).toLocaleString()}` : "Last scanned: —"}
                          {a.last_drift_detected_at
                            ? ` · Last change detected: ${new Date(a.last_drift_detected_at).toLocaleString()}`
                            : ""}
                        </div>
                      </div>

                      <button
                        onClick={() => scanNow(a.id)}
                        disabled={demoMode || scanning}
                        title={demoMode ? "Scanning is disabled in demo mode" : "Scan this job application now"}
                        style={{
                          padding: "8px 10px",
                          cursor: demoMode || scanning ? "not-allowed" : "pointer",
                          opacity: demoMode ? 0.6 : 1,
                        }}
                      >
                        {scanning ? "Scanning…" : "Scan now"}
                      </button>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      {scanErr && (
                        <p style={{ color: "crimson", margin: 0 }}>
                          Scan error: {scanErr}
                        </p>
                      )}

                      {scanRes?.alert && <AlertBanner alert={scanRes.alert} />}

                      {scanRes && !scanRes.alert && !scanErr && (
                        <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>
                          No changes detected since the last scan.
                          {scanRes.checkedAt ? ` (${new Date(scanRes.checkedAt).toLocaleString()})` : ""}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <p style={{ marginTop: 16, fontSize: 13, opacity: 0.85 }}>
              Free plan: 1 tracked job application. <Link href="/upgrade">Upgrade to track more</Link>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
