import LegalLayout from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Privacy Policy — JobPort",
};

export default function PrivacyPage() {
  const sections = [
    { id: "data", label: "Data we access" },
    { id: "use", label: "How we use it" },
    { id: "storage", label: "Storage" },
    { id: "third-party", label: "Third-party services" },
    { id: "choices", label: "Your choices" },
    { id: "contact", label: "Contact" },
  ];

  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="JobPort respects your privacy. This policy explains what data we access, how we use it, and your choices."
      updated="Last updated: Jan 2026"
      sections={sections}
    >
      <h2 id="data">What data we access</h2>
      <ul>
        <li>Google account identity (name, email address)</li>
        <li>Read-only access to Gmail inbox signals related to job applications</li>
        <li>
          We do <strong>not</strong> send email on your behalf, modify your inbox, or access
          unrelated personal content.
        </li>
      </ul>

      <h2 id="use">How we use data</h2>
      <p>
        We analyze job-related signals (applications, interviews, follow-ups) to build a job
        application dashboard for you.
      </p>

      <h2 id="storage">Data storage</h2>
      <p>
        We store only the metadata required to provide the service. You can disconnect your account
        at any time.
      </p>

      <h2 id="third-party">Third-party services</h2>
      <p>
        JobPort uses Google OAuth and Google APIs. Use of those services is governed by Google’s
        own privacy policies.
      </p>

      <h2 id="choices">Your choices</h2>
      <p>
        You may revoke Google access at any time through your Google Account settings.
      </p>

      <div className="hr" />

      <h2 id="contact">Contact</h2>
      <div className="callout">
        For questions or concerns, contact us at{" "}
        <a href="mailto:support@tryjobport.com">support@tryjobport.com</a>.
      </div>
    </LegalLayout>
  );
}
