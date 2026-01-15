"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";


import { useRequireAuth } from "../../lib/requireAuth";
import { apiFetch } from "@/lib/api";
import AlertBanner from "@/components/AlertBanner";

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

function formatWithTz(date) {
  if (!date) return "";
  try {
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return date.toLocaleString();
  }
}

function meetingLabel(url) {
  if (!url) return "Join meeting";
  const u = String(url).toLowerCase();
  if (u.includes("meet.google.com")) return "Join Meet";
  if (u.includes("zoom.us")) return "Join Zoom";
  if (u.includes("teams.microsoft.com")) return "Join Teams";
  if (u.includes("webex.com")) return "Join Webex";
  if (u.includes("calendar.google.com")) return "Open Calendar";
  if (u.includes("outlook.office.com") || u.includes("outlook.live.com")) return "Open Calendar";
  return "Join meeting";
}

function stageBucket(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("offer")) return "Offer";
  if (s.includes("interview")) return "Interview";
  if (s.includes("denied") || s.includes("rejected") || s.includes("closed")) return "Denied";
  return "Applied";
}

function prettySignal(signal) {
  if (!signal) return "—";
  if (typeof signal === "string") return signal;
  try {
    return JSON.stringify(signal, null, 2);
  } catch {
    return String(signal);
  }
}

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

  const [scanningId, setScanningId] = useState("");
  const [scanErrById, setScanErrById] = useState({});
  const [scanResultById, setScanResultById] = useState({});

  // Explanation panel state
  const [selectedAppId, setSelectedAppId] = useState("");
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainErr, setExplainErr] = useState("");
  const [explanation, setExplanation] = useState(null);

  async function loadApplications() {
    const json = await apiFetch("/applications");
    setData(json);
  }

  async function loadExplanation(appId) {
    setSelectedAppId(appId);
    setExplainLoading(true);
    setExplainErr("");
    setExplanation(null);

    try {
      const json = await apiFetch(`/applications/${appId}/explanation`);
      if (!json?.ok) throw new Error(json?.error || "Failed to load explanation");
      setExplanation(json.explanation || null);
    } catch (e) {
      setExplainErr(e.message || "Failed to load explanation");
    } finally {
      setExplainLoading(false);
    }
  }

  // Boot load (guarded while auth resolves)
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function boot() {
      try {
        setErr("");
        const json = await apiFetch("/applications");
        if (cancelled) return;
        setData(json);

        // Auto-select first item (if any) to make "why did this move?" immediate.
        const firstId = json?.applications?.[0]?.id;
        if (firstId) {
          loadExplanation(firstId);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || "Failed to load job applications");
          setData(null);
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      await loadApplications();

      // If you scanned the selected app, refresh its explanation as well.
      if (selectedAppId && selectedAppId === appId) {
        await loadExplanation(appId);
      }
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
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0 }}>Job applications</h1>
          <Link href="/dashboard" style={{ fontSize: 14 }}>
            ← Back to Dashboard
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {activeStage ? (
            <>
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
                Clear
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div style={{ marginTop: 16 }}>
        {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
        {!data && !err && <p>Loading…</p>}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* LEFT: list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {data && filteredApps.length === 0 && (
            <p style={{ opacity: 0.8 }}>
              {activeStage ? `No job applications in “${activeStage}”.` : "No job applications tracked yet."}
            </p>
          )}

          {filteredApps.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredApps.map((a) => {
                const scanning = scanningId === a.id;
                const scanErr = scanErrById[a.id];
                const scanRes = scanResultById[a.id];

                const isSelected = selectedAppId === a.id;

                return (
                  <li key={a.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => loadExplanation(a.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") loadExplanation(a.id);
                      }}
                      style={{
                        border: isSelected ? "2px solid rgba(0,0,0,0.35)" : "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 16,
                        padding: 12,
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 15 }}>{a.company}</strong>
                            <span style={{ opacity: 0.9 }}>— {a.role}</span>
                          </div>

                          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                            Status: <strong>{a.status}</strong>
                            {a.portal ? ` · Portal: ${a.portal}` : ""}
                            {a.url ? (
                              <>
                                {" "}
                                ·{" "}
                                <a href={a.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                  Open
                                </a>
                              </>
                            ) : null}
                            {" · "}
                            <Link href={`/job-applications/${a.id}`} onClick={(e) => e.stopPropagation()}>
                              View history
                            </Link>

                            {/* Meeting CTA (minimal): show only when link exists */}
                            {a.next_interview_link ? (
                              <>
                                {" · "}
                                <a
                                  href={a.next_interview_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "4px 8px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(0,0,0,0.15)",
                                    textDecoration: "none",
                                    fontWeight: 700,
                                    opacity: 0.95,
                                  }}
                                  title="Join meeting"
                                >
                                  Join meeting
                                </a>
                              </>
                            ) : null}
                          </div>

                          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
                            {a.last_bearing_at
                              ? `Last scanned: ${new Date(a.last_bearing_at).toLocaleString()}`
                              : "Last scanned: —"}
                            {a.last_drift_detected_at
                              ? ` · Last change detected: ${new Date(a.last_drift_detected_at).toLocaleString()}`
                              : ""}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              scanNow(a.id);
                            }}
                            disabled={scanning}
                            style={{
                              padding: "8px 10px",
                              cursor: scanning ? "not-allowed" : "pointer",
                              opacity: scanning ? 0.7 : 1,
                              borderRadius: 12,
                              border: "1px solid rgba(0,0,0,0.15)",
                              background: "white",
                              fontWeight: 600,
                            }}
                          >
                            {scanning ? "Scanning…" : "Scan now"}
                          </button>
                        </div>
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
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* RIGHT: explanation panel */}
        <aside
          style={{
            width: 460,
            flex: "0 0 460px",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 16,
            padding: 14,
            background: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Why did this job move?</div>
            {selectedAppId ? <span style={{ fontSize: 12, opacity: 0.6 }}>app: {selectedAppId}</span> : null}
          </div>

          <div style={{ marginTop: 10 }}>
            {!selectedAppId && (
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                Select a job application to see the triggering email and detected signal.
              </div>
            )}

            {selectedAppId && explainLoading && <div style={{ opacity: 0.7, fontSize: 13 }}>Loading…</div>}

            {selectedAppId && !explainLoading && explainErr && (
              <div style={{ color: "crimson", fontSize: 13 }}>{explainErr}</div>
            )}

            {selectedAppId && !explainLoading && !explainErr && !explanation && (
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                No explanation yet for this job application. (We haven’t linked a triggering email to a status change.)
              </div>
            )}

            {selectedAppId && !explainLoading && !explainErr && explanation && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Triggering email */}
                <section>
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Triggering email</div>
                  {explanation.email ? (
                    <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, padding: 10 }}>
                      <div style={{ fontWeight: 700 }}>{explanation.email.subject || "(no subject)"}</div>
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{explanation.email.from}</div>
                      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{explanation.email.receivedAt}</div>
                    </div>
                  ) : (
                    <div style={{ opacity: 0.7, fontSize: 13 }}>Not available (no linked email found).</div>
                  )}
                </section>

                {/* Extracted signal */}
                <section>
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Extracted signal</div>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontSize: 12,
                      lineHeight: 1.35,
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: "rgba(0,0,0,0.02)",
                      maxHeight: 220,
                      overflow: "auto",
                    }}
                  >
                    {prettySignal(explanation.signal)}
                  </pre>
                </section>

                {/* Status change reason */}
                <section>
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Status change reason</div>
                  <div style={{ fontWeight: 800 }}>
                    {(explanation.prevStatus || "Unknown")} → {(explanation.nextStatus || "Unknown")}
                  </div>
                  <div style={{ opacity: 0.9, marginTop: 4 }}>
                    {explanation.reason || "Reason not provided yet."}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
                    Detected: {explanation.occurredAt || "—"}
                  </div>
                </section>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
