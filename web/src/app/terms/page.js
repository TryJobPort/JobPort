import LegalLayout from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Terms of Service — JobPort",
};

export default function TermsPage() {
  const sections = [
    { id: "service", label: "Service" },
    { id: "accounts", label: "Accounts" },
    { id: "use", label: "Acceptable use" },
    { id: "availability", label: "Availability" },
    { id: "termination", label: "Termination" },
    { id: "contact", label: "Contact" },
  ];

  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="By using JobPort, you agree to these terms. If you do not agree, do not use the service."
      updated="Last updated: Jan 2026"
      sections={sections}
    >
      <h2 id="service">Service description</h2>
      <p>
        JobPort provides tools to track and organize job applications using inbox-derived signals.
      </p>

      <h2 id="accounts">Accounts</h2>
      <p>
        You are responsible for maintaining the security of your account and for all activity under it.
      </p>

      <h2 id="use">Acceptable use</h2>
      <p>
        You agree not to misuse the service, interfere with its operation, or attempt to access data
        not intended for you.
      </p>

      <h2 id="availability">Availability</h2>
      <p>
        The service is provided “as is” and may change over time. We do not guarantee uninterrupted availability.
      </p>

      <h2 id="termination">Termination</h2>
      <p>
        You may stop using JobPort at any time. We reserve the right to suspend or terminate access for misuse.
      </p>

      <div className="hr" />

      <h2 id="contact">Contact</h2>
      <div className="callout">
        Questions about these terms can be sent to{" "}
        <a href="mailto:support@tryjobport.com">support@tryjobport.com</a>.
      </div>
    </LegalLayout>
  );
}
