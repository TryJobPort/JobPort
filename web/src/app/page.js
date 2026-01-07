"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function isValidEmail(email) {
  const e = String(email || "").trim();
  return e.includes("@") && e.includes(".") && e.length >= 6;
}

const DEMO_SLIDES = [
  {
    key: "pipeline",
    title: "Pipeline overview",
    body: "Applied → Interview → Offer → Denied, built automatically from your signals.",
    src: "/demo/slide-1.png",
    alt: "JobPort demo pipeline overview",
  },
  {
    key: "interview",
    title: "Interview surfaced",
    body: "Upcoming interviews are elevated with one-click actions to join and open the source email.",
    src: "/demo/slide-2.png",
    alt: "JobPort demo showing interview surfaced",
  },
  {
    key: "change",
    title: "Change detected",
    body: "Status changes are detected and explained so you know what moved and why.",
    src: "/demo/slide-3.png",
    alt: "JobPort demo showing status change detected",
  },
];

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  const [hoverPrimary, setHoverPrimary] = useState(false);
  const [hoverGoogle, setHoverGoogle] = useState(false);
  const [hoverGetStarted, setHoverGetStarted] = useState(false);

  const canContinue = useMemo(() => isValidEmail(email), [email]);

  function onSubmit(e) {
    e.preventDefault();

    const clean = String(email || "").trim();
    if (!isValidEmail(clean)) {
      setErr("Enter a valid email.");
      return;
    }

    setErr("");

    try {
      localStorage.setItem("jp_activation_email", clean);
    } catch {}

    router.push("/importing");
  }

  function onGetStarted() {
    const el = document.getElementById("jp-email");
    if (el) el.focus();
  }

  return (
    <main style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Header */}
      <header
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "rgba(255,255,255,0.9)",
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "inherit",
            fontWeight: 800,
            letterSpacing: 0.2,
          }}
        >
          JobPort
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/login"
            style={{
              textDecoration: "none",
              color: "inherit",
              fontSize: 14,
              opacity: 0.85,
            }}
          >
            Log in
          </Link>

          <button
            type="button"
            onClick={onGetStarted}
            onMouseEnter={() => setHoverGetStarted(true)}
            onMouseLeave={() => setHoverGetStarted(false)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.14)",
              background: hoverGetStarted ? "rgba(0,0,0,0.04)" : "#fff",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: hoverGetStarted
                ? "0 6px 18px rgba(0,0,0,0.08)"
                : "none",
              transition: "background 120ms ease, box-shadow 120ms ease",
            }}
          >
            Get started
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "44px 24px",
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 28,
          alignItems: "center",
        }}
      >
        {/* Left */}
        <div>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 1.2,
              fontWeight: 800,
              opacity: 0.7,
              marginBottom: 10,
            }}
          >
            JOB APPLICATION MONITORING
          </div>

          <h1
            style={{
              margin: "0 0 12px",
              fontSize: 52,
              lineHeight: 1.03,
              letterSpacing: -0.6,
              maxWidth: 760,
            }}
          >
            Your job pipeline, built automatically.
          </h1>

          <p style={{ margin: 0, fontSize: 16, opacity: 0.82, maxWidth: 720 }}>
            See what moved, what’s stuck, and what needs attention—especially interviews and
            meaningful status changes.
          </p>

          <form onSubmit={onSubmit} style={{ marginTop: 22, maxWidth: 560 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                id="jp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setErr("")}
                placeholder="you@email.com"
                autoComplete="email"
                style={{
                  flex: "1 1 280px",
                  padding: "12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.18)",
                  fontSize: 15,
                  outline: "none",
                }}
              />

              <button
                type="submit"
                disabled={!canContinue}
                onMouseEnter={() => setHoverPrimary(true)}
                onMouseLeave={() => setHoverPrimary(false)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: canContinue ? "pointer" : "not-allowed",
                  fontWeight: 800,
                  background:
                    hoverPrimary && canContinue ? "rgba(0,0,0,0.04)" : "#fff",
                  boxShadow:
                    hoverPrimary && canContinue
                      ? "0 6px 18px rgba(0,0,0,0.08)"
                      : "none",
                  transition: "background 120ms ease, box-shadow 120ms ease",
                }}
              >
                See your job pipeline
              </button>
            </div>

            {err && (
              <p style={{ marginTop: 10, color: "crimson", fontSize: 13 }}>
                {err}
              </p>
            )}

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Read-only. We don’t send email or modify your inbox.
            </div>

            <div style={{ marginTop: 14, maxWidth: 420 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                Or continue with
              </div>

              <a
                href="/signup"
                onMouseEnter={() => setHoverGoogle(true)}
                onMouseLeave={() => setHoverGoogle(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  textDecoration: "none",
                  fontWeight: 700,
                  color: "inherit",
                  background: hoverGoogle
                    ? "rgba(0,0,0,0.03)"
                    : "rgba(255,255,255,0.9)",
                  boxShadow: hoverGoogle
                    ? "0 3px 10px rgba(0,0,0,0.06)"
                    : "none",
                  transition: "background 120ms ease, box-shadow 120ms ease",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(0,0,0,0.18)",
                    fontSize: 12,
                    fontWeight: 900,
                    opacity: 0.85,
                  }}
                >
                  G
                </span>
                Continue with Google
              </a>
            </div>
          </form>
        </div>

        {/* Right */}
        <DemoCarousel />
      </section>

      <footer
        style={{
          padding: "18px 24px 28px",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          opacity: 0.75,
          fontSize: 12,
        }}
      >
        © {new Date().getFullYear()} JobPort
      </footer>
    </main>
  );
}

function DemoCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(
      () => setIdx((v) => (v + 1) % DEMO_SLIDES.length),
      5200
    );
    return () => clearInterval(t);
  }, [paused]);

  const slide = DEMO_SLIDES[idx];

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        background: "rgba(255,255,255,0.95)",
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>
          LIVE PREVIEW
        </div>

        <h3 style={{ margin: "10px 0 8px", fontSize: 18 }}>{slide.title}</h3>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>{slide.body}</p>

        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            overflow: "hidden",
            background: "rgba(0,0,0,0.02)",
          }}
        >
          <img
            src={slide.src}
            alt={slide.alt}
            style={{ width: "100%", height: 260, objectFit: "cover" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {DEMO_SLIDES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setIdx(i)}
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.25)",
              background: i === idx ? "rgba(0,0,0,0.35)" : "transparent",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>
    </section>
  );
}
