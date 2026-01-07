"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isValidEmail(email) {
  const e = String(email || "").trim();
  return e.includes("@") && e.includes(".") && e.length >= 6;
}

export default function ImportingPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [
      "Starting your workspace",
      "Preparing your dashboard",
      "Loading a demo pipeline",
      "Getting you into the product",
    ],
    []
  );

  useEffect(() => {
    try {
      setEmail(localStorage.getItem("jp_activation_email") || "");
    } catch {}
  }, []);

  useEffect(() => {
    // If someone hits /importing directly without going through /
    // send them back to the activation gate.
    const clean = String(email || "").trim();
    if (email && !isValidEmail(clean)) {
      router.push("/");
      return;
    }

    // Lightweight “setup” progress (truthful demo mode).
    const timers = [];

    timers.push(setTimeout(() => setStep(1), 450));
    timers.push(setTimeout(() => setStep(2), 1050));
    timers.push(setTimeout(() => setStep(3), 1650));

    // Auto-continue into the product
    timers.push(
      setTimeout(() => {
        router.push("/job-applications");
      }, 2200)
    );

    return () => timers.forEach(clearTimeout);
  }, [email, router]);

  const activeIndex = clamp(step, 0, steps.length - 1);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#fff",
      }}
    >
      <section
        style={{
          width: "min(760px, 100%)",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          background: "rgba(255,255,255,0.95)",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 1.2, fontWeight: 700, opacity: 0.75 }}>
          SETUP
        </div>

        <h1 style={{ margin: "10px 0 6px", fontSize: 28 }}>
          Preparing your JobPort dashboard…
        </h1>

        <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>
          {email ? (
            <>
              Using: <strong>{email}</strong>
            </>
          ) : (
            "Setting up your workspace."
          )}
        </p>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            Progress
          </div>

          <div
            style={{
              height: 10,
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.03)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${((activeIndex + 1) / steps.length) * 100}%`,
                background: "rgba(0,0,0,0.18)",
                transition: "width 240ms ease",
              }}
            />
          </div>
        </div>

        <ul style={{ marginTop: 14, paddingLeft: 18, fontSize: 14, opacity: 0.88 }}>
          {steps.map((label, idx) => {
            const done = idx < activeIndex;
            const active = idx === activeIndex;

            return (
              <li
                key={label}
                style={{
                  marginBottom: 8,
                  opacity: done ? 0.75 : active ? 1 : 0.55,
                  fontWeight: active ? 700 : 400,
                }}
              >
                {label}
              </li>
            );
          })}
        </ul>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
          Continuing automatically…
        </div>
      </section>
    </main>
  );
}
