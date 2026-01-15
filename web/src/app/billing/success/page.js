import Link from "next/link";
import AppShell from "@/components/AppShell";

export default function BillingSuccessPage() {
  return (
    <AppShell>
      <div className="jp-page">
        <div className="jp-card" style={{ maxWidth: 560, margin: "56px auto" }}>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em" }}>
            You’re upgraded
          </h1>

          <p style={{ marginTop: 10, color: "var(--muted)", lineHeight: 1.4 }}>
            Thanks — Pro is now unlocked. Your dashboard will reflect your upgraded plan.
          </p>

          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <Link className="jp-btn jp-btn--primary" href="/dashboard">
              Go to dashboard
            </Link>
            <Link className="jp-btn" href="/plans">
              View plans
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
