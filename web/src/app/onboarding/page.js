"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch("/me");
        if (!me?.ok) {
          router.replace("/login");
          return;
        }

        // If user has already connected email/imported, go to pipeline
        const status = await apiFetch("/import/status").catch(() => null);

        if (status?.ok && (status?.state === "done" || status?.done)) {
          router.replace("/job-applications");
          return;
        }

        // Otherwise, force connect/import path
        router.replace("/importing");
      } catch (e) {
        router.replace("/login");
      }
    })();
  }, [router]);

  return null;
}
