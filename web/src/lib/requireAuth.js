"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "./api";

export function useRequireAuth({ redirectTo = "/login" } = {}) {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // ✅ API route is /auth/me (NOT /me)
        const json = await apiFetch("/auth/me");
        if (!alive) return;

        if (!json?.ok || !json?.user?.id) throw new Error("not authed");
        setMe(json.user);
      } catch (_) {
        if (alive) router.replace(redirectTo);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, redirectTo]);

  return { me, loading };
}
