"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";

export default function PlansPage() {
  const router = useRouter();

  function choose(plan) {
    try {
      localStorage.setItem("jp_plan", plan);
      if (plan === "pro") {
        localStorage.setItem("jp_trial_active", "true");
        localStorage.setItem("jp_trial_started_at", String(Date.now()));
      } else {
        localStorage.removeItem("jp_trial_active");
        localStorage.removeItem("jp_trial_started_at");
      }
    } catch {}

    router.push("/onboarding");
  }

  return (
    <AppShell title="Plans">
      <main className="jp-page">
        <div className="jp-plans">
          <div className="jp-plans__head">
            <div>
              <div className="jp-plans__kicker">PLANS</div>
              <h1 className="jp-plans__title">Pick a plan to get started</h1>
              <p className="jp-plans__sub">
                Free gives you a trustworthy system of record. Pro adds analysis surfaces that
                help you act faster—without noise.
              </p>
            </div>

            <div className="jp-plans__topActions">
              <Link className="jp-btn jp-btn--ghost" href="/">
                Back
              </Link>
            </div>
          </div>

          <div className="jp-plans__grid">
            {/* FREE */}
            <section className="jp-plansCard">
              <div className="jp-plansCard__badge">Best for getting started</div>

              <div className="jp-plansCard__header">
                <div className="jp-plansCard__plan">Free</div>
                <div className="jp-plansCard__price">
                  $0<span className="jp-plansCard__per">/mo</span>
                </div>
                <div className="jp-plansCard__desc">
                  Your pipeline, built from inbox signals. Pins + interview links included.
                </div>
              </div>

              <button
                type="button"
                className="jp-btn jp-btn--primary jp-plansCard__cta"
                onClick={() => choose("free")}
              >
                Continue Free
              </button>

              <div className="jp-plansCard__fine">
                No card required. Connect your inbox next.
              </div>

              <ul className="jp-plansCard__list">
                <li>Track job applications</li>
                <li>Swim lanes (Applied / Interview / Offer / Denied)</li>
                <li>Pinned-first sorting (trustworthy)</li>
                <li>Filters + search</li>
                <li>Upcoming interview detection (one per job application)</li>
                <li>Join meeting CTA (Meet / Zoom)</li>
              </ul>
            </section>

            {/* PRO */}
            <section className="jp-plansCard jp-plansCard--pro">
              <div className="jp-plansCard__badge jp-plansCard__badge--pro">
                For power users
              </div>

              <div className="jp-plansCard__header">
                <div className="jp-plansCard__plan">Pro</div>
                <div className="jp-plansCard__price">
                  Coming soon<span className="jp-plansCard__per"> </span>
                </div>
                <div className="jp-plansCard__desc">
                  Surfaces what’s next—follow-ups, velocity, and flow insights.
                </div>
              </div>

              <button
                type="button"
                className="jp-btn jp-plansCard__cta jp-btn--ghost"
                onClick={() => choose("pro")}
              >
                Start Pro (preview)
              </button>

              <div className="jp-plansCard__fine">
                Visible now. Unlock later with a frictionless upgrade.
              </div>

              <ul className="jp-plansCard__list">
                <li>Sankey flow interactions (inputs → outputs)</li>
                <li>Follow-up radar (what’s due)</li>
                <li>Stage timeline insights (gaps + pace)</li>
                <li>Re-engagement signals (company back in motion)</li>
                <li>Velocity meter (rolling 14–30 days)</li>
              </ul>
            </section>
          </div>

          <div className="jp-plans__foot">
            <p className="jp-plans__footNote">
              Next: connect your inbox. We read signals, not everything—and we never send email or
              modify your inbox.
            </p>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
