"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";

export function usePlan() {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("free");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const json = await apiFetch("/auth/me"); // adjust if your apiFetch already prefixes /auth
        const p = json?.user?.plan || "free";
        if (alive) setPlan(p);
      } catch {
        if (alive) setPlan("free");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return { loading, plan, isPro: plan === "pro" };
}
