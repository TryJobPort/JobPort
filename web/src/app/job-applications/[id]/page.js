"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import AlertBanner from "../../../components/AlertBanner";
import { apiFetch } from "../../../lib/api";

function safeJsonParse(maybeJson) {
  if (!maybeJson) return null;
  if (typeof maybeJson === "object") return maybeJson;
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function fmtStatusChange(ev) {
  if (!ev?.status_changed) return null;
  const prev = ev.prev_status_signal || "UNKNOWN";
  const next = ev.next_status_signal || "UNKNOWN";
  return `${prev} → ${next}`;
}

function extractFirstLink(text) {
  if (!text) return "";
  const m = String(text).match(/https?:\/\/[^\s"')]+/i);
  return m ? m[0] : "";
}

function extractMeetingLink(payloadObj, fallbackText) {
  // Prefer explicit fields if your payloads have them; otherwise regex-search.
  const candidates = [];

  if (payloadObj) {
    for (const k of [
      "meeting_link",
      "meetingUrl",
      "meeting_url",
      "join_url",
      "joinUrl",
      "hangoutLink",
      "conferenceData",
    ]) {
      const v = payloadObj?.[k];
      if (typeof v === "string") candidates.push(v);
    }

    // nested-ish common patterns
    const hang = payloadObj?.conferenceData?.entryPoints?.[0]?.uri;
    if (typeof hang === "string") candidates.push(hang);

    const html = payloadObj?.html || payloadObj?.body || payloadObj?.raw_body;
    if (typeof html === "string") candidates.push(html);
  }

  if (typeof fallbackText === "string") candidates.push(fallbackText);

  for (const c of candidates) {
    const link = extractFirstLink(c);
    if (link) return link;
  }

  return "";
}

function eventTitle(ev) {
  if (ev?.status_changed) return "Status changed";
  if (ev?.drift_detected) return "Change detected";
  return "Checked";
}

function eventSubtitle(ev) {
  const sc = fmtStatusChange(ev);
  if (sc) return sc;
  if (ev?.drift_detected) return "Content drift detected";
  return "No meaningful change detected";
}

export default function JobApplicationDetailPage({ params }) {
  const { id } = use(params);

  const [appRow, setAppRow] = useState(null);
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState("");

  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const [scanResult, setScanResult] = useState(null);

  async function loadAll() {
    // ✅ cookie-auth (credentials include) — no x-user-id
    const [appRes, eventsRes] = await Promise.all([
      apiFetch(`/applications/${id}`),
      apiFetch(`/applications/${id}/events`),
    ]);

    setAppRow(appRes.application);
    setEvents(eventsRes.events || []);
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        setErr("");
        await loadAll();
        if (cancelled) return;
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    }

    if (id) boot();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function scanNow() {
    try {
      setErr("");
      setScanErr("");
      setScanning(true);
      setScanResult(null);

      const result = await apiFetch(`/applications/${id}/take-bearing`, {
        method: "POST",
      });

      setScanResult({
        checkedAt: result.checkedAt || result.checked_at || null,
        driftDetected: !!result.driftDetected || !!result.drift_detected,
        alert: result.alert || null,
      });

      await loadAll();
    } catch (e) {
      setScanErr(e.message);
    } finally {
      setScanning(false);
    }
  }

  const nextInterview = useMemo(() => {
    if (!appRow) return null;

    const at = appRow.next_interview_at || "";
    const link = appRow.next_interview_link || "";
    const source = appRow.next_interview_source || "";
    const emailId = appRow.next_interview_email_id || "";

    return {
      at,
      link,
      source,
      emailId,
    };
  }, [appRow]);

  const timeline = useMemo(() => {
    const list = (events || []).map((ev) => {
      const payloadObj = safeJsonParse(ev.payload);
      const meetingLink = extractMeetingLink(payloadObj, ev.payload);

      return {
        ...ev,
        _payloadObj: payloadObj,
        _meetingLink: meetingLink,
        _title: eventTitle(ev),
        _subtitle: eventSubtitle(ev),
      };
    });

    return list;
  }, [events]);

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/dashboard">← Back to dashboard</Link>
        <div style={{ flex: 1 }} />
        <Link href="/job-applications">List view</Link>
      </header>

      <div style={{ marginTop: 16 }}>
        {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
        {!appRow && !err && <p>Loading…</p>}

        {appRow && (
          <>
            {/* Top summary */}
            <div
              style={{
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 18,
                padding: 16,
                background: "white",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {appRow.company || "—"}
                  </div>
                  <div style={{ marginTop: 2, opacity: 0.85 }}>{appRow.role || "—"}</div>

                  <div style={{ fontSize: 13, opacity: 0.75, marginTop: 10 }}>
                    Status: <strong>{appRow.status || "—"}</strong>
                    {appRow.portal ? ` · Portal: ${appRow.portal}` : ""}
                    {appRow.url ? (
                      <>
                        {" "}
                        ·{" "}
                        <a href={appRow.url} target="_blank" rel="noreferrer">
                          Open job application page
                        </a>
                      </>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                    Last scanned: {fmtDateTime(appRow.last_bearing_at)}
                    {appRow.last_drift_detected_at
                      ? ` · Last change detected: ${fmtDateTime(appRow.last_drift_detected_at)}`
                      : ""}
                  </div>
                </div>

                <button
                  onClick={scanNow}
                  disabled={scanning}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: scanning ? "rgba(0,0,0,0.04)" : "white",
                    cursor: scanning ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {scanning ? "Scanning…" : "Scan now"}
                </button>
              </div>

              {/* Scan result / alert */}
              <div style={{ marginTop: 12 }}>
                {scanErr && (
                  <p style={{ color: "crimson", margin: 0 }}>Scan error: {scanErr}</p>
                )}
                {scanResult?.alert && <AlertBanner alert={scanResult.alert} />}
                {scanResult && !scanResult.alert && !scanErr && (
                  <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>
                    No changes detected since the last scan.
                    {scanResult.checkedAt ? ` (${fmtDateTime(scanResult.checkedAt)})` : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Interview block (Phase 23 hero CTA) */}
            {nextInterview?.at ? (
              <section
                style={{
                  marginTop: 14,
                  border: "2px solid rgba(0,120,255,0.30)",
                  background: "rgba(0,120,255,0.06)",
                  borderRadius: 18,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>Next interview</div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>{fmtDateTime(nextInterview.at)}</div>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {nextInterview.link ? (
                    <a
                      href={nextInterview.link}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        textDecoration: "none",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,120,255,0.35)",
                        background: "white",
                        fontWeight: 800,
                      }}
                    >
                      Open meeting link
                    </a>
                  ) : (
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      Meeting link not found yet (we’ll keep scanning).
                    </div>
                  )}

                  {nextInterview.source ? (
                    <div style={{ fontSize: 12, opacity: 0.75, alignSelf: "center" }}>
                      Source: {nextInterview.source}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* Timeline (Phase 23 core) */}
            <section style={{ marginTop: 18 }}>
              <h2 style={{ margin: "0 0 10px 0" }}>Timeline</h2>

              {timeline.length === 0 ? (
                <p style={{ fontSize: 13, opacity: 0.8 }}>No events yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {timeline.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 16,
                        padding: 14,
                        background: "white",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{ev._title}</div>
                        <div style={{ opacity: 0.7, fontSize: 13 }}>{ev._subtitle}</div>
                      </div>

                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                        Checked: {fmtDateTime(ev.checked_at || ev.created_at)}
                        {ev.source ? ` · Source: ${ev.source}` : ""}
                      </div>

                      {ev._meetingLink ? (
                        <div style={{ marginTop: 10 }}>
                          <a
                            href={ev._meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: "inline-flex",
                              textDecoration: "none",
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: "1px solid rgba(0,120,255,0.35)",
                              background: "rgba(0,120,255,0.08)",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            Open meeting link
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
