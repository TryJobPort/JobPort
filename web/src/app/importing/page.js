import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import ImportingClient from "./ImportingClient";

export default function ImportingPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <ImportingClient />
      </Suspense>
    </AppShell>
  );
}
