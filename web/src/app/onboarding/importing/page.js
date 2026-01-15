import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import OnboardingImportingClient from "./OnboardingImportingClient";

export default function OnboardingImportingPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <OnboardingImportingClient />
      </Suspense>
    </AppShell>
  );
}
