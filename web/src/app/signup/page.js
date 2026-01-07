"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    try {
      setErr("");
      setLoading(true);
      await apiFetch("/auth/signup", {
        method: "POST",
        body: { email },
      });
      router.push("/job-applications");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 420, margin: "80px auto" }}>
      <h1>Welcome to JobPort</h1>
      <p style={{ opacity: 0.8 }}>
        Track your job applications. We read email signals — we don’t replace email.
      </p>

      <form onSubmit={submit} style={{ marginTop: 20 }}>
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.2)",
          }}
        />

        <button
          disabled={loading}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
          }}
        >
          {loading ? "Creating account…" : "Get started"}
        </button>

        {err && (
          <p style={{ color: "crimson", marginTop: 10 }}>
            {err}
          </p>
        )}
      </form>

      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 14 }}>
        Gmail access is optional and read-only. You’ll connect it later.
      </p>
    </main>
  );
}
