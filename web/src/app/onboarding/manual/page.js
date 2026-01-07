"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "../../components/AppShell";
import AlertBanner from "../../components/AlertBanner";
import { apiFetch } from "../../lib/api";

const STATUS_OPTIONS = ["Applied", "Under Review", "Interview", "Offer", "Rejected"];

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);

  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("Applied");

  // Optional (kept for later; not blocking MVP)
  const [email, setEmail] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [createdId, setCreatedId] = useState("");

  useEffect(() => {
    try {
      const complete = localStorage.getItem("jp_onboarding_complete");
      if (complete === "true") {
        router.replace("/job-applications");
        return;
      }

      const existingEmail = localStorage.getItem("jp_apply_email");
      if (existingEmail) setEmail(existingEmail);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinueStep1 = useMemo(() => {
    const u = String(url || "").trim();
    return u.startsWith("http://") || u.startsWith("https://");
  }, [url]);

  const canContinueStep2 = useMemo(() => {
    const c = String(company || "").trim();
    const r = String(role || "").trim();
    return c.length > 0 && r.length > 0;
  }, [company, role]);

  async function createAndBaseline() {
    setErr("");
    setBusy(true);

    try {
      const payload = {
        company: String(company || "").trim(),
        role: String(role || "").trim(),
        url: String(url || "").trim(),
        status: String(status || "Applied").trim(),
      };

      // 1) Create job application (API requires company, role, url)
      const created = await apiFetch("/applications", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const applicationId = created?.application?.id || created?.id;
      if (!applicationId) throw new Error("Create succeeded but no job application id returned.");

      setCreatedId(applicationId);

      // 2) Baseline scan (first win)
      await apiFetch(`/applications/${applicationId}/take-bearing`, {
        method: "POST",
      });

      // 3) Save onboarding state + optional email for later
      try {
        localStorage.setItem("jp_onboarding_complete", "true");
        if (email && email.includes("@")) localStorage.setItem("jp_apply_email", String(email).trim());
      } catch {}

      // 4) Success → take them to the newly created job application
      rrouter.push(`/job-applications/${applicationId}?created=1`);
    } catch (e) {
      const msg = e?.message || "Something went wrong.";
      setErr(msg);

      // If free limit reached, route to upgrade (keep it frictionless but clear)
      if (String(msg).includes("FREE_LIMIT_REACHED") || String(msg).includes("Free plan supports tracking")) {
        // Keep user on page so they see message, but give a direct escape hatch.
        // (They can click View plans below.)
      }
    } finally {
      setBusy(false);
    }
  }

  function nextFromStep1(e) {
    e.preventDefault();
    setErr("");

    if (!canContinueStep1) {
      setErr("Please paste a valid job application URL (must start with http:// or https://).");
      return;
    }

    setStep(2);
  }

  function back() {
    setErr("");
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <AppShell active="applications" title="Get started">
      <div className="jp-page">
        <div className="jp-stack">
          {err ? <AlertBanner tone="critical" title="Fix this to continue" message={err} /> : null}

          <div className="jp-card">
            <div className="jp-card__header">
              <div className="jp-card__title">Track your first job application</div>
              <div className="jp-card__subtitle">
                Add a job application page, save a baseline, then JobPort can alert you when the status changes.
              </div>
            </div>

            {/* Simple stepper header */}
            <div className="jp-muted" style={{ padding: "0 18px 10px" }}>
              Step {step} of 2
            </div>

            {step === 1 ? (
              <form onSubmit={nextFromStep1} className="jp-form">
                <div className="jp-form__grid">
                  <label className="jp-field jp-field--full">
                    <div className="jp-field__label">Job application URL</div>
                    <input
                      className="jp-input"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://jobs.lever.co/... or https://myworkdayjobs.com/..."
                      autoFocus
                    />
                    <div className="jp-field__hint">Paste the URL to the job application page you want JobPort to monitor.</div>
                  </label>

                  <label className="jp-field jp-field--full">
                    <div className="jp-field__label">Email you apply with (optional)</div>
                    <input
                      className="jp-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                    <div className="jp-field__hint">Optional. Stored locally for later workflows. No email is sent.</div>
                  </label>
                </div>

                <div className="jp-form__actions">
                  <button className="jp-btn jp-btn--primary" type="submit" disabled={!canContinueStep1 || busy}>
                    Continue
                  </button>

                  <button className="jp-btn jp-btn--ghost" type="button" onClick={() => router.push("/job-applications")}>
                    Skip onboarding
                  </button>
                </div>
              </form>
            ) : (
              <div className="jp-form">
                <div className="jp-form__grid">
                  <label className="jp-field jp-field--full">
                    <div className="jp-field__label">Company</div>
                    <input
                      className="jp-input"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Acme Corp"
                      autoFocus
                    />
                  </label>

                  <label className="jp-field jp-field--full">
                    <div className="jp-field__label">Role</div>
                    <input
                      className="jp-input"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Product Manager"
                    />
                  </label>

                  <label className="jp-field jp-field--full">
                    <div className="jp-field__label">Current status</div>
                    <select className="jp-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div className="jp-field__hint">This is just your starting point. JobPort will detect changes over time.</div>
                  </label>

                  <div className="jp-muted" style={{ gridColumn: "1 / -1" }}>
                    Monitoring: <span style={{ fontWeight: 700 }}>{String(url || "").trim() || "—"}</span>
                  </div>
                </div>

                <div className="jp-form__actions">
                  <button className="jp-btn jp-btn--ghost" type="button" onClick={back} disabled={busy}>
                    Back
                  </button>

                  <button
                    className="jp-btn jp-btn--primary"
                    type="button"
                    onClick={createAndBaseline}
                    disabled={!canContinueStep2 || busy}
                  >
                    {busy ? "Saving baseline…" : "Save baseline & start monitoring"}
                  </button>

                  <button className="jp-btn jp-btn--ghost" type="button" onClick={() => router.push("/upgrade")} disabled={busy}>
                    View plans
                  </button>
                </div>

                {createdId ? (
                  <div className="jp-muted" style={{ paddingTop: 10 }}>
                    Created job application: <span style={{ fontWeight: 700 }}>{createdId}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="jp-muted">
            Tip: Start with one job application you care about most. Once you see a baseline saved, the product makes sense.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
