"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import InlineNotice from "../../components/InlineNotice";
import AlertBanner from "../../components/AlertBanner";
import AppShell from "../../components/AppShell";
import ApplicationRow from "../../components/ApplicationRow";
import EmptyState from "../../components/EmptyState";
import { SkeletonList } from "../../components/Skeletons";
import { apiFetch } from "../../lib/api";
import { APPLICATION_STATUS } from "../../lib/contracts";
import { useToast } from "../../components/ToastProvider";

export default function JobApplicationsPage() {
  const router = useRouter();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const [scanningId, setScanningId] = useState("");
  const [scanErrById, setScanErrById] = useState({});
  const [scanResultById, setScanResultById] = useState({});

  const applications = data?.applications || [];
  const firstApp = applications[0];

  const showFirstScanNudge =
    applications.length === 1 && !firstApp?.baseline_established_at;

  async function load() {
    const json = await apiFetch("/applications", { userId: "isaac" });
    setData(json);
  }

  // Bootstrap demo (fire-and-forget)
  useEffect(() => {
    apiFetch("/bootstrap/demo", { method: "POST", userId: "isaac" }).catch(
      () => {}
    );
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr("");
        const json = await apiFetch("/applications", { userId: "isaac" });
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          const message = e?.message || String(e);
          setErr(message);
          toast.push({
            tone: "error",
            title: "Load failed",
            message,
            ttl: 3200,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  async function scanNow(appId, company, role) {
    try {
      setErr("");
      setScanningId(appId);

      setScanErrById((m) => ({ ...m, [appId]: "" }));
      setScanResultById((m) => ({ ...m, [appId]: null }));

      const result = await apiFetch(`/applications/${appId}/take-bearing`, {
        method: "POST",
        userId: "isaac",
      });

      const scanRes = {
        checkedAt: result?.checkedAt,
        driftDetected: !!result?.driftDetected,
        alert: result?.alert || null,
      };

      setScanResultById((m) => ({ ...m, [appId]: scanRes }));

      if (scanRes.alert?.type === "JOB_APPLICATION_STATUS_CHANGED") {
        toast.push({
          tone: "error",
          title: "Status change detected",
          message: `${company} — ${role}`,
          ttl: 4200,
        });
      } else if (
        scanRes.driftDetected ||
        scanRes.alert?.type === "JOB_APPLICATION_PAGE_CHANGED"
      ) {
        toast.push({
          tone: "warning",
          title: "Page changed",
          message: `${company} — ${role}`,
          ttl: 3600,
        });
      } else {
        toast.push({
          tone: "success",
          title: "Scan complete",
          message: `${company} — ${role}`,
          ttl: 2200,
        });
      }

      await load();
    } catch (e) {
      const message = e?.message || String(e);
      setScanErrById((m) => ({ ...m, [appId]: message }));

      toast.push({
        tone: "error",
        title: "Scan failed",
        message,
        ttl: 4200,
      });
    } finally {
      setScanningId("");
    }
  }

  return (
    <AppShell
      active="applications"
      title="Job applications"
      cta={
        <Link className="jp-btn jp-btn--primary" href="/job-applications/new">
          Add job application
        </Link>
      }
    >
      <div className="jp-page">
        <div className="jp-stack">
          {err ? (
            <AlertBanner
              alert={{ title: "Load failed", message: err }}
            />
          ) : null}

          {!data && !err ? <SkeletonList count={6} /> : null}

          {applications.length >= 1 ? (
            <InlineNotice
              tone="warn"
              title="Free plan limit"
              message="You’re currently tracking 1 job application. Upgrade to monitor more and get unlimited alerts."
              ctaLabel="Upgrade"
              ctaHref="/upgrade"
            />
          ) : null}

          {showFirstScanNudge ? (
            <div className="jp-card jp-card--hint">
              <div className="jp-row">
                <div className="jp-muted">
                  Run your first scan to establish a baseline.
                </div>
                <span className="jp-spacer" />
                <button
                  className="jp-btn jp-btn--primary"
                  onClick={() =>
                    scanNow(firstApp.id, firstApp.company, firstApp.role)
                  }
                >
                  Scan now
                </button>
              </div>
            </div>
          ) : null}

          {data && applications.length === 0 ? (
            <div className="jp-card">
              <EmptyState
                title="No job applications yet"
                subtitle="Add a job application URL and we’ll start monitoring it for changes."
                primaryHref="/job-applications/new"
                primaryLabel="Add job application"
              />
            </div>
          ) : null}

          {applications.length > 0 ? (
            <ul className="jp-list">
              {applications.map((a) => {
                const scanning = scanningId === a.id;
                const scanErr = scanErrById[a.id];
                const scanRes = scanResultById[a.id];
                const normalizedStatus = normalizeStatus(a.status);

                return (
                  <li key={a.id} className="jp-list-card">
                    <ApplicationRow
                      company={a.company}
                      role={a.role}
                      status={normalizedStatus}
                      lastCheckedAt={a.last_bearing_at || null}
                      health="healthy"
                      onClick={() =>
                        router.push(`/job-applications/${a.id}`)
                      }
                    />

                    <div className="jp-list-card__meta">
                      {a.portal ? <span>Portal: {a.portal}</span> : null}

                      {a.url ? (
                        <a
                          className="jp-btn jp-btn--ghost"
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      ) : null}

                      <Link
                        className="jp-btn jp-btn--ghost"
                        href={`/job-applications/${a.id}`}
                      >
                        View history
                      </Link>

                      <span className="jp-spacer" />

                      <button
                        className="jp-btn"
                        onClick={() =>
                          scanNow(a.id, a.company, a.role)
                        }
                        disabled={scanning}
                      >
                        {scanning ? "Scanning…" : "Scan now"}
                      </button>
                    </div>

                    <div className="jp-list-card__foot">
                      <div className="jp-muted">
                        {a.last_bearing_at
                          ? `Last scanned: ${new Date(
                              a.last_bearing_at
                            ).toLocaleString()}`
                          : "Last scanned: —"}
                        {a.last_drift_detected_at
                          ? ` · Last change detected: ${new Date(
                              a.last_drift_detected_at
                            ).toLocaleString()}`
                          : ""}
                      </div>

                      {scanErr ? (
                        <AlertBanner
                          alert={{ title: "Scan error", message: scanErr }}
                        />
                      ) : null}

                      {scanRes?.alert ? (
                        <AlertBanner alert={scanRes.alert} />
                      ) : null}

                      {scanRes && !scanRes.alert && !scanErr ? (
                        <div className="jp-muted jp-list-card__note">
                          No changes detected
                          {scanRes.checkedAt
                            ? ` (${new Date(
                                scanRes.checkedAt
                              ).toLocaleString()})`
                            : ""}
                          .
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {applications.length > 0 ? (
            <div className="jp-muted">
              Free plan: limited tracked job applications.{" "}
              <Link href="/upgrade">Upgrade</Link>.
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function normalizeStatus(status) {
  if (!status) return APPLICATION_STATUS.APPLIED;

  const s = String(status).trim().toLowerCase();

  if (s === "applied") return APPLICATION_STATUS.APPLIED;
  if (s === "under review" || s === "under_review" || s === "under-review")
    return APPLICATION_STATUS.UNDER_REVIEW;
  if (s === "interview" || s === "interviewing")
    return APPLICATION_STATUS.INTERVIEW;
  if (s === "offer" || s === "offered")
    return APPLICATION_STATUS.OFFER;
  if (s === "rejected" || s === "declined")
    return APPLICATION_STATUS.REJECTED;

  return APPLICATION_STATUS.APPLIED;
}
