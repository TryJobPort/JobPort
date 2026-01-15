"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export default function SignupPage() {
  const [err, setErr] = useState("");

  const googleHref = useMemo(() => `${API_BASE}/auth/google/start`, []);

  return (
    <main style={{ padding: 24, maxWidth: 460, margin: "80px auto" }}>
      <h1 style={{ marginBottom: 6 }}>Welcome to JobPort</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Track your job applications. We read email signals — we don’t replace email.
      </p>

      {err ? (
        <p style={{ color: "crimson", marginTop: 12 }}>{err}</p>
      ) : null}

      <a
        href={googleHref}
        onClick={() => setErr("")}
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.15)",
          textDecoration: "none",
          fontWeight: 800,
          color: "inherit",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
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

      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 14, lineHeight: 1.4 }}>
        Read-only Gmail access. We don’t send email or modify your inbox.
      </p>

      <div style={{ marginTop: 18, display: "flex", gap: 12, fontSize: 13 }}>
        <Link href="/" style={{ opacity: 0.8 }}>← Back</Link>
      </div>
    </main>
  );
}
