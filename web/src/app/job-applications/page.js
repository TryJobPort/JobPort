import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import JobApplicationsClient from "./JobApplicationsClient";

export default function JobApplicationsPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <JobApplicationsClient />
      </Suspense>
    </AppShell>
  );
}
