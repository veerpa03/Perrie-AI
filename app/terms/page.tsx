import LegalPageLayout from "@/components/LegalPageLayout";
import { LEGAL_CONTACT_EMAIL, LEGAL_ENTITY_NAME, LEGAL_JURISDICTION, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata = { title: "Terms of Service — Perrie" };

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        These terms govern use of Perrie, a personal AI assistant that answers phone calls, manages tasks, and
        connects to services like Google Calendar on behalf of an owner. By signing in to the Perrie dashboard or
        letting Perrie place or receive calls on your behalf, you agree to these terms.
      </p>

      <h2>What Perrie does</h2>
      <p>
        Perrie lets an owner configure an AI voice assistant that can answer or place phone calls, carry out tasks
        (such as checking or updating a calendar, or looking up a contact) through integrations the owner explicitly
        connects, and keep a record of calls and tasks in a dashboard. Some actions that change something — sending
        a message, booking something, anything with a real-world side effect — require the person on the call to
        clearly confirm before Perrie goes ahead.
      </p>

      <h2>Your responsibilities as an owner</h2>
      <ul>
        <li>You&apos;re responsible for the accuracy of the information you give Perrie and for how you use it — including instructing Perrie not to do something you don&apos;t want it to do.</li>
        <li>You&apos;re responsible for complying with the laws that apply to your calls, including call-recording and consent laws in your jurisdiction and the jurisdictions of people you call or who call you. Perrie discloses that it&apos;s an automated assistant and that calls may be recorded, but you remain responsible for using it lawfully.</li>
        <li>You won&apos;t use Perrie to harass, defraud, impersonate a real person or organization without disclosure, or break the law.</li>
        <li>You&apos;re responsible for the Twilio, Google, or other third-party accounts and credentials you connect to Perrie, and for revoking access you no longer want Perrie to have.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to use Perrie to:</p>
      <ul>
        <li>Make unsolicited or mass automated calls (robocalling/spam), or calls intended to deceive or defraud a recipient.</li>
        <li>Attempt to extract another owner&apos;s private information, or bypass the guardrails that keep an owner&apos;s private details from being shared with people who aren&apos;t the owner.</li>
        <li>Interfere with or attempt to disrupt the service, probe it for vulnerabilities without authorization, or use it to build a competing product by scraping or reverse-engineering it.</li>
        <li>Violate any applicable law, including telecommunications, data protection, and consumer protection law.</li>
      </ul>

      <h2>Accounts and access</h2>
      <p>
        Access to the dashboard is tied to your sign-in. Keep your credentials secure — you&apos;re responsible for
        activity that happens through your account. If you believe your account has been compromised, contact us
        immediately.
      </p>

      <h2>Third-party services</h2>
      <p>
        Perrie&apos;s calling, speech, language-model, calendar, contacts, and storage functionality depends on
        third-party providers (for example Twilio, Deepgram, Anthropic, Google, and Supabase). Your use of those
        providers&apos; services through Perrie is also subject to their own terms, and we aren&apos;t responsible for their
        availability, accuracy, or acts and omissions.
      </p>

      <h2>No professional advice</h2>
      <p>
        Perrie is a task assistant. Nothing it says or does is legal, medical, financial, or other professional
        advice, and it should not be relied on as such.
      </p>

      <h2>Disclaimers</h2>
      <p>
        Perrie is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; Like any AI system, it can misunderstand speech, make
        mistakes, or fail to complete a task correctly. We don&apos;t guarantee the service will be uninterrupted,
        error-free, or fit for a particular purpose, and we disclaim all warranties to the fullest extent the law
        allows.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {LEGAL_ENTITY_NAME} will not be liable for indirect, incidental,
        special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from your use of
        Perrie, even if advised of the possibility of such damages.
      </p>

      <h2>Termination</h2>
      <p>
        You can stop using Perrie and disconnect your integrations at any time from the dashboard. We may suspend or
        terminate access if we believe these terms have been violated, or to protect the service or other people
        using it.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. If we make a material change, we&apos;ll update the
        &ldquo;Last updated&rdquo; date above. Continuing to use Perrie after a change means you accept the updated terms.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of {LEGAL_JURISDICTION}, without regard to conflict-of-law rules.</p>

      <h2>Contact us</h2>
      <p>
        Questions about these terms can be sent to <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
      <p className="text-xs text-[color:var(--color-slate)]/55">
        {LEGAL_ENTITY_NAME} operates Perrie. Replace the placeholders in this document (entity name, contact email,
        jurisdiction) with your real details before publishing.
      </p>
    </LegalPageLayout>
  );
}
