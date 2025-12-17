"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import TimelineItem from "../../../components/TimelineItem";
import AppShell from "../../../components/AppShell";
import AlertBanner from "../../../components/AlertBanner";
import { apiFetch } from "../../../lib/api";
import { SkeletonTimeline } from "../../../components/Skeletons";
import EmptyState from "../../../components/EmptyState";

export default function JobApplicationDetailPage({ params }) {
  const { id } = use(params);

  const [appRow, setAppRow] = useState(null);
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState("");

  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const [scanResult, setScanResult] = useState(null);

  async function loadAll() {
    const [appRes, eventsRes] = await Promise.all([
      apiFetch(`/applications/${id}`, { userId: "isaac" }),
      apiFetch(`/applications/${id}/events`, { userId: "isaac" }),
    ]);

    setAppRow(appRes.application);
    setEvents(eventsRes.events || []);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr("");
        await loadAll();
      } catch (e) {
        if (!cancelled) setErr(e?.message || String(e));
      }
    })();

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
        userId: "isaac",
      });

      setScanResult({
        checkedAt: result?.checkedAt,
        driftDetected: !!result?.driftDetected,
        alert: result?.alert || null,
      });

      await loadAll();
    } catch (e) {
      setScanErr(e?.message || String(e));
    } finally {
      setScanning(false);
    }
  }

  return (
    <AppShell
      active="applications"
      title="Job application"
      cta={
        <Link className="jp-btn jp-btn--ghost" href="/job-applications">
          Back
        </Link>
      }
    >
      <div className="jp-page">
        <div className="jp-stack">
          {err ? <AlertBanner tone="critical" title="Load failed" message={err} /> : null}

          {!appRow && !err ? <SkeletonTimeline count={6} /> : null}

          {appRow ? (
            <>
              {/* Header */}
              <div className="jp-card">
                <div className="jp-card__header">
                  <div className="jp-row">
                    <div className="jp-grow">
                      <div className="jp-card__title">
                        {appRow.company} — {appRow.role}
                      </div>

                      <div className="jp-card__subtitle">
                        Status: {appRow.status}
                        {appRow.portal ? ` · Portal: ${appRow.portal}` : ""}
                        {appRow.url ? (
                          <>
                            {" · "}
                            <a
                              className="jp-link"
                              href={appRow.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open job application page
                            </a>
                          </>
                        ) : null}
                      </div>

                      {appRow.last_status_signal ? (
                        <div className="jp-muted jp-mt-3">
                          Inferred status: {appRow.last_status_signal}
                          {appRow.last_status_signal_at
                            ? ` · ${new Date(
                                appRow.last_status_signal_at
                              ).toLocaleString()}`
                            : ""}
                          {appRow.last_status_change_at
                            ? ` · Last status change: ${new Date(
                                appRow.last_status_change_at
                              ).toLocaleString()}`
                            : ""}
                        </div>
                      ) : null}
                    </div>

                    <div className="jp-row jp-gap-2">
                      {appRow.is_demo ? (
                        <button
                          className="jp-btn jp-btn--danger"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                "Remove demo job application? This cannot be undone."
                              )
                            ) {
                              return;
                            }

                            await apiFetch(
                              `/applications/${appRow.id}/remove-demo`,
                              {
                                method: "DELETE",
                                userId: "isaac",
                              }
                            );

                            window.location.href = "/job-applications";
                          }}
                        >
                          Remove demo
                        </button>
                      ) : null}

                      <button
                        className="jp-btn"
                        onClick={scanNow}
                        disabled={scanning}
                      >
                        {scanning ? "Scanning…" : "Scan now"}
                      </button>
                    </div>
                  </div>

                  <div className="jp-mt-4">
                    {scanErr ? (
                      <AlertBanner
                        tone="critical"
                        title="Scan failed"
                        message={scanErr}
                      />
                    ) : null}

                    {scanResult?.alert ? (
                      <AlertBanner alert={scanResult.alert} />
                    ) : null}

                    {scanResult && !scanResult.alert && !scanErr ? (
                      <div className="jp-muted">
                        No changes detected
                        {scanResult.checkedAt
                          ? ` (${new Date(
                              scanResult.checkedAt
                            ).toLocaleString()})`
                          : ""}
                        .
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Health */}
              <div className="jp-card">
                <div className="jp-card__header">
                  <div className="jp-card__title jp-h2">Health</div>
                  <div className="jp-card__subtitle">
                    Scan cadence and failure state for this job application.
                  </div>

                  <div className="jp-stack jp-mt-4 jp-gap-2">
                    <div className="jp-muted">
                      Last scanned:{" "}
                      {appRow.last_bearing_at
                        ? new Date(
                            appRow.last_bearing_at
                          ).toLocaleString()
                        : "—"}
                    </div>

                    <div className="jp-muted">
                      Next scan:{" "}
                      {appRow.next_scan_at
                        ? new Date(
                            appRow.next_scan_at
                          ).toLocaleString()
                        : "—"}
                    </div>

                    <div className="jp-muted">
                      Scan state:{" "}
                      {appRow.scan_locked_until
                        ? `Locked until ${new Date(
                            appRow.scan_locked_until
                          ).toLocaleString()}`
                        : "Idle"}
                    </div>

                    {appRow.consecutive_scan_failures ? (
                      <div className="jp-muted">
                        Consecutive failures:{" "}
                        {appRow.consecutive_scan_failures}
                      </div>
                    ) : null}

                    {appRow.last_scan_error_message ? (
                      <div className="jp-danger">
                        Last scan error: {appRow.last_scan_error_message}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Events */}
              <div className="jp-card">
                <div className="jp-card__header">
                  <div className="jp-row">
                    <div className="jp-grow">
                      <div className="jp-card__title jp-h2">
                        Event history
                      </div>
                      <div className="jp-card__subtitle">
                        Showing {Math.min(events.length, 10)} of{" "}
                        {events.length}
                      </div>
                    </div>
                  </div>

                  {events.length === 0 ? (
                    <EmptyState
                      title="No events yet"
                      subtitle="Run a scan to establish a baseline and start tracking changes."
                      primaryLabel={scanning ? "Scanning…" : "Scan now"}
                      primaryOnClick={scanNow}
                      primaryDisabled={scanning}
                    />
                  ) : (
                    <div className="jp-stack jp-mt-4">
                      {events.slice(0, 10).map((ev) => (
                        <TimelineItem
                          key={ev.id}
                          eventType={ev.event_type}
                          statusChanged={!!ev.status_changed}
                          driftDetected={!!ev.drift_detected}
                          prevStatus={ev.prev_status_signal}
                          nextStatus={ev.next_status_signal}
                          checkedAt={ev.checked_at || ev.created_at}
                          source={ev.source}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
