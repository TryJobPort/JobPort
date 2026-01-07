"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import WelcomeCard from "../../components/WelcomeCard";
import AppShell from "../../components/AppShell";
import AlertRow from "../../components/AlertRow";
import { apiFetch } from "../../lib/api";
import AlertBanner from "../../components/AlertBanner";
import EmptyState from "../../components/EmptyState";
import { SkeletonList } from "../../components/Skeletons";
import { useToast } from "../../components/ToastProvider";
import { useRequireAuth } from "../../lib/requireAuth";

export default function AlertsPage() {
  const router = useRouter(); // ✅ FIX: router was referenced but never defined
  const { loading: authLoading } = useRequireAuth({ redirectTo: "/login" });
  const toast = useToast();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);

  const [clearingId, setClearingId] = useState("");
  const [clearErrById, setClearErrById] = useState({});

  const alertsRaw = data?.alerts || [];

  const alerts = useMemo(() => {
    const score = (a) => {
      const sev = toSeverity(a);
      if (sev === "critical") return 3;
      if (sev === "warn") return 2;
      return 1;
    };

    return [...alertsRaw].sort((a, b) => {
      const s = score(b) - score(a);
      if (s !== 0) return s;

      const ta = a?.checkedAt ? new Date(a.checkedAt).getTime() : 0;
      const tb = b?.checkedAt ? new Date(b.checkedAt).getTime() : 0;
      return tb - ta;
    });
  }, [alertsRaw]);

  const lastCheckedAt = data?.alerts_meta?.last_checked_at || null;

  const monitoringState = useMemo(() => {
    if (!data) return "idle";
    if (alerts.length > 0) return "active";
    if (lastCheckedAt) return "active";
    return "idle";
  }, [data, alerts.length, lastCheckedAt]);

  // One-time welcome card
  useEffect(() => {
    try {
      const seen = localStorage.getItem("jp_seen_welcome");
      if (!seen) setShowWelcome(true);
    } catch {}
  }, []);

  async function ensurePipelineOrRedirect() {
    // If user has no job applications, force them into ingestion.
    const apps = await apiFetch("/applications").catch(() => null);
    const list = Array.isArray(apps?.applications) ? apps.applications : null;
    if (list && list.length === 0) {
      router.replace("/importing");
      return false;
    }
    return true;
  }

  async function loadAlerts({ enforceZeroState = true } = {}) {
    setErr("");
    const json = await apiFetch("/alerts");
    setData(json);

    if (enforceZeroState) {
      // If no alerts, confirm they actually have a pipeline; otherwise push to importing.
      if (Array.isArray(json?.alerts) && json.alerts.length === 0) {
        const ok = await ensurePipelineOrRedirect();
        if (!ok) return null;
      }
    }

    return json;
  }

  // Load alerts on page mount
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    (async () => {
      try {
        const json = await apiFetch("/alerts");
        if (cancelled) return;

        setErr("");
        setData(json);

        // Zero-state enforcement
        if (Array.isArray(json?.alerts) && json.alerts.length === 0) {
          const apps = await apiFetch("/applications").catch(() => null);
          if (cancelled) return;

          const list = Array.isArray(apps?.applications) ? apps.applications : [];
          if (list.length === 0) {
            router.replace("/importing");
            return;
          }
        }
      } catch (e) {
        if (cancelled) return;

        const message = e?.message || String(e);
        setErr(message);
        toast.push({
          tone: "error",
          title: "Load failed",
          message,
          ttl: 3200,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, router, toast]);

  async function clearAlert(applicationId, company, role) {
    try {
      setErr("");
      setClearingId(applicationId);
      setClearErrById((m) => ({ ...m, [applicationId]: "" }));

      await apiFetch("/alerts/clear", { method: "POST" });

      toast.push({
        tone: "success",
        title: "Alerts cleared",
        message: `${company} — ${role}`,
        ttl: 2200,
      });

      await loadAlerts({ enforceZeroState: true });
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

  if (authLoading) return null;

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
          {/* Monitoring status cue */}
          <div className="jp-row jp-mb-2">
            {monitoringState === "active" ? (
              <span className="jp-monitoring-pill">Monitoring active</span>
            ) : (
              <span className="jp-muted">Monitoring idle</span>
            )}

            <span className="jp-spacer" />

            {lastCheckedAt ? (
              <div className="jp-muted">Last checked {new Date(lastCheckedAt).toLocaleString()}</div>
            ) : null}
          </div>

          {showWelcome ? (
            <WelcomeCard
              onDismiss={() => {
                try {
                  localStorage.setItem("jp_seen_welcome", "1");
                } catch {}
                setShowWelcome(false);
              }}
            />
          ) : null}

          {err ? <AlertBanner tone="critical" title="Load failed" message={err} /> : null}

          {!data && !err ? <SkeletonList count={5} /> : null}

          {/* Empty but active monitoring */}
          {data && alerts.length === 0 && monitoringState === "active" ? (
            <div className="jp-card">
              <EmptyState
                title="You’re being monitored"
                subtitle={
                  lastCheckedAt
                    ? `Monitoring is active. No changes detected as of ${new Date(lastCheckedAt).toLocaleString()}.`
                    : "Monitoring is active. We’ll alert you if something meaningful changes."
                }
                primaryHref="/job-applications"
                primaryLabel="View job applications"
              />
            </div>
          ) : null}

          {/* Alerts list */}
          {alerts.length > 0 ? (
            <ul className="jp-list">
              {alerts.map((a) => {
                const clearing = clearingId === a.applicationId;
                const clearErr = clearErrById[a.applicationId];

                const detectedAtLabel = a.checkedAt ? `Detected: ${new Date(a.checkedAt).toLocaleString()}` : "";

                return (
                  <li key={a.id} className={`jp-list-card jp-alert--${toSeverity(a)}`}>
                    <AlertRow
                      company={a.company}
                      role={a.role}
                      severity={toSeverity(a)}
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
                        <AlertBanner tone="critical" title="Clear failed" message={clearErr} />
                      </div>
                    ) : null}
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
