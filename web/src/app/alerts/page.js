"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WelcomeCard from "../../components/WelcomeCard";
import AppShell from "../../components/AppShell";
import AlertRow from "../../components/AlertRow";
import { apiFetch } from "../../lib/api";
import AlertBanner from "../../components/AlertBanner";
import EmptyState from "../../components/EmptyState";
import { SkeletonList } from "../../components/Skeletons";
import { useToast } from "../../components/ToastProvider";

export default function AlertsPage() {
  const toast = useToast();
  const [showWelcome, setShowWelcome] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const [clearingId, setClearingId] = useState("");
  const [clearErrById, setClearErrById] = useState({});

  async function load() {
    const json = await apiFetch("/alerts", { userId: "isaac" });
    setData(json);
  }

  useEffect(() => {
    useEffect(() => {
  const seen = localStorage.getItem("jp_seen_welcome");
  if (!seen) setShowWelcome(true);
}, []);

    let cancelled = false;

    async function boot() {
      try {
        setErr("");
        const json = await apiFetch("/alerts", { userId: "isaac" });
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          const message = e?.message || String(e);
          setErr(message);
          toast.push({ tone: "error", title: "Load failed", message, ttl: 3200 });
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  async function clearAlert(applicationId, company, role) {
    try {
      setErr("");
      setClearingId(applicationId);
      setClearErrById((m) => ({ ...m, [applicationId]: "" }));

      await apiFetch(`/applications/${applicationId}/clear-alerts`, {
        method: "POST",
        userId: "isaac",
      });

      toast.push({
        tone: "success",
        title: "Alerts cleared",
        message: `${company} — ${role}`,
        ttl: 2200,
      });

      await load();
    } catch (e) {
      const message = e?.message || String(e);
      setClearErrById((m) => ({ ...m, [applicationId]: message }));

      toast.push({
        tone: "error",
        title: "Clear failed",
        message,
        ttl: 4200,
      });
    } finally {
      setClearingId("");
    }
  }

  const alerts = data?.alerts || [];
{showWelcome ? (
  <WelcomeCard
    onDismiss={() => {
      localStorage.setItem("jp_seen_welcome", "1");
      setShowWelcome(false);
    }}
  />
) : null}

  return (
    <AppShell
      active="alerts"
      title="Alerts"
      cta={
        <Link className="jp-btn jp-btn--ghost" href="/job-applications">
          Job applications
        </Link>
      }
    >
      <div className="jp-page">
        <div className="jp-stack">
          {err ? (
            <AlertBanner tone="critical" title="Load failed" message={err} />
          ) : null}

          {!data && !err ? <SkeletonList count={5} /> : null}

          {data && alerts.length === 0 ? (
            <div className="jp-card">
              <EmptyState
                title="No alerts yet"
                subtitle="Run “Scan now” on a job application to generate alerts for changes."
                primaryHref="/job-applications"
                primaryLabel="Go to job applications"
              />
            </div>
          ) : null}

          {alerts.length > 0 ? (
            <ul className="jp-list">
              {alerts.map((a) => {
                const clearing = clearingId === a.applicationId;
                const clearErr = clearErrById[a.applicationId];

                const detectedAtLabel = a.checkedAt
                  ? `Detected: ${new Date(a.checkedAt).toLocaleString()}`
                  : "";

                const severity = toSeverity(a);

                return (
                  <li key={a.id} className="jp-list-card">
                    <div className="jp-card__header">
                      <AlertRow
                        company={a.company}
                        role={a.role}
                        severity={severity}
                        isDemo={a.is_demo === 1 || a.is_demo === "1"}
                        title={a.alert?.title || "Alert"}
                        message={a.alert?.message || ""}
                        detectedAtLabel={detectedAtLabel}
                        primaryAction={a.alert?.primaryAction || null}
                        secondaryAction={a.alert?.secondaryAction || null}
                        clearing={clearing}
                        onClear={() => clearAlert(a.applicationId, a.company, a.role)}
                  />

                      {clearErr ? (
                        <div className="jp-list-card__note">
                          <AlertBanner
                            tone="critical"
                            title="Clear failed"
                            message={clearErr}
                          />
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function toSeverity(a) {
  const type = String(a?.alert?.type || "");

  if (type === "JOB_APPLICATION_STATUS_CHANGED") return "critical";
  if (type === "JOB_APPLICATION_PAGE_CHANGED") return "warn";

  const sev = String(a?.alert?.severity || "").toUpperCase();
  if (sev === "HIGH") return "critical";

  return "info";
}
