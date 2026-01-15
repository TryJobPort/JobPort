"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "../../../components/AppShell";
import AlertBanner from "../../../components/AlertBanner";
import { apiFetch } from "@/lib/api";
import { useToast } from "../../../components/ToastProvider";

const STATUSES = ["Applied", "Under Review", "Interview", "Offer", "Rejected"];

export default function NewJobApplicationPage() {
  const router = useRouter();
  const toast = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    company: "",
    role: "",
    portal: "",
    status: "Applied",
    url: "",
  });

  const canSubmit = useMemo(() => {
    return (
      form.company.trim() &&
      form.role.trim() &&
      form.status.trim() &&
      form.url.trim()
    );
  }, [form]);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function isFreeLimitError(e) {
    const msg = String(e?.message || "").toLowerCase();
    const code = String(e?.code || "").toLowerCase();
    const raw = String(e?.raw || "").toLowerCase();
    
    return (
      msg.includes("free plan") ||
      msg.includes("upgrade") ||
      msg.includes("limit") ||
      msg.includes("free_limit_reached") ||
      code.includes("free_limit_reached") ||
      raw.includes("free_limit_reached")
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit || isSaving) return;

    const company = form.company.trim();
    const role = form.role.trim();

    try {
      setIsSaving(true);
      setErr("");

      await apiFetch("/applications", {
        method: "POST",
        userId: "isaac",
        body: JSON.stringify({
          company,
          role,
          portal: form.portal.trim() || null,
          status: form.status.trim(),
          url: form.url.trim(),
        }),
      });

      toast.push({
        tone: "success",
        title: "Job application added",
        message: `${company} — ${role}`,
        ttl: 2200,
      });

      router.push("/job-applications");
    } catch (e2) {
      // Phase 5.3.3: graceful free-limit redirect
      if (isFreeLimitError(e2)) {
        toast.push({
          tone: "warning",
          title: "Free plan limit reached",
          message: "Upgrade to track more job applications.",
          ttl: 3200,
        });
        router.push("/upgrade");
        return;
      }

      const message = e2?.message || "Failed to create job application";
      setErr(message);

      toast.push({
        tone: "error",
        title: "Create failed",
        message,
        ttl: 3200,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell
      title="Add job application"
      cta={
        <button
          className="jp-btn jp-btn--ghost"
          type="button"
          onClick={() => router.push("/job-applications")}
        >
          Back
        </button>
      }
    >
      {err ? (
        <AlertBanner tone="critical" title="Create failed" message={err} />
      ) : null}

      <div className="jp-card">
        <div className="jp-card__header">
          <div className="jp-card__title">Track a job application</div>
          <div className="jp-card__subtitle">
            Add the job application URL to enable scanning and alerts.
          </div>
        </div>

        <form onSubmit={onSubmit} className="jp-form">
          <div className="jp-form__grid">
            <label className="jp-field">
              <div className="jp-field__label">Company</div>
              <input
                className="jp-input"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                placeholder="Acme"
                autoFocus
              />
            </label>

            <label className="jp-field">
              <div className="jp-field__label">Role</div>
              <input
                className="jp-input"
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
                placeholder="Product Manager"
              />
            </label>

            <label className="jp-field jp-field--full">
              <div className="jp-field__label">Job portal (optional)</div>
              <input
                className="jp-input"
                value={form.portal}
                onChange={(e) => update("portal", e.target.value)}
                placeholder="Workday / Greenhouse / Lever"
              />
            </label>

            <label className="jp-field">
              <div className="jp-field__label">Initial status</div>
              <select
                className="jp-select"
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="jp-field jp-field--full">
              <div className="jp-field__label">Job application URL</div>
              <input
                className="jp-input"
                value={form.url}
                onChange={(e) => update("url", e.target.value)}
                placeholder="https://..."
              />
              <div className="jp-field__hint">
                Required. This is what we monitor for status changes.
              </div>
            </label>
          </div>

          <div className="jp-form__actions">
            <button
              className="jp-btn jp-btn--primary"
              type="submit"
              disabled={!canSubmit || isSaving}
            >
              {isSaving ? "Saving…" : "Track job application"}
            </button>
          </div>

          <div className="jp-muted jp-form__note">
            Free plan currently supports tracking a limited number of job
            applications.
          </div>
        </form>
      </div>
    </AppShell>
  );
}
