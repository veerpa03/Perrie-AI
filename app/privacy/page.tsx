import LegalPageLayout from "@/components/LegalPageLayout";
import { LEGAL_CONTACT_EMAIL, LEGAL_ENTITY_NAME, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata = { title: "Privacy Policy — Perrie" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        Perrie is a personal AI assistant that answers phone calls, manages tasks, and connects to services like
        Google Calendar on behalf of its owner. This policy explains what data Perrie collects, why, and how it is
        used — both for the owner who sets Perrie up, and for people who call or are called by Perrie.
      </p>

      <h2>Who this applies to</h2>
      <p>This policy covers three kinds of people:</p>
      <ul>
        <li><strong>Owners</strong> — people who sign in to the Perrie dashboard and configure their own assistant.</li>
        <li><strong>Callers and counterparts</strong> — people who call an owner&apos;s Perrie number, or whom Perrie calls on an owner&apos;s behalf. These people have not created an account and may not know Perrie in advance.</li>
        <li><strong>Delegates</strong> — people an owner has explicitly allowed to use Perrie on their behalf.</li>
      </ul>

      <h2>AI call disclosure</h2>
      <p>
        Perrie identifies itself as an automated AI assistant at the start of a call, and discloses that calls may be
        recorded and transcribed. We do this because it is the right thing to do, and because call-recording consent
        laws vary by jurisdiction — see the Terms of Service for the owner&apos;s own responsibility to comply with the
        laws that apply to their calls.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account and profile data</strong> — name, contact details, timezone, and assistant preferences the owner provides when setting up Perrie.</li>
        <li><strong>Call data</strong> — phone numbers, call metadata (time, duration, direction), and a transcript of what was said during the call, including by non-owner callers.</li>
        <li><strong>Task and integration data</strong> — tasks Perrie is asked to carry out, and data read from or written to connected services (for example, Google Calendar events or Google Contacts entries) needed to carry those tasks out.</li>
        <li><strong>Guardrail and quality logs</strong> — records of things like confirmation prompts before an action, blocked attempts to leak private details to a non-owner, or flagged attempts to manipulate the assistant. These exist to keep Perrie safe and reliable, not to build a profile of callers.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To operate the call itself: understanding speech, generating a spoken response, and carrying out the task requested.</li>
        <li>To show the owner their own calls, tasks, and transcripts in the dashboard.</li>
        <li>To protect non-owners: Perrie actively filters private details about the owner out of anything said to a caller who isn&apos;t the owner, and logs (rather than silently ignores) attempts to get around that.</li>
        <li>To improve reliability — for example, understanding why a call failed so we can fix it.</li>
      </ul>
      <p>We do not sell personal data, and we do not use call transcripts to train third-party advertising products.</p>

      <h2>Who we share it with</h2>
      <p>Perrie&apos;s backend calls on a small number of service providers to work. Data flows to them only as needed to do the job the owner configured:</p>
      <ul>
        <li><strong>Telephony</strong> (e.g. Twilio) — to place and receive calls.</li>
        <li><strong>Speech services</strong> (e.g. Deepgram) — to transcribe speech to text and synthesize speech from text, in real time during a call.</li>
        <li><strong>Language model provider</strong> (e.g. Anthropic) — to generate the assistant&apos;s responses from the conversation.</li>
        <li><strong>Calendar and contacts</strong> (e.g. Google, via OAuth the owner explicitly grants) — only for the specific scopes the owner connects, and only used for the tasks the owner asks Perrie to perform.</li>
        <li><strong>Storage</strong> (e.g. Supabase, or local storage on the owner&apos;s own server if no database is configured) — to persist profile, call, and task records.</li>
      </ul>
      <p>
        Each of these providers processes data under its own privacy terms as our data processor; we don&apos;t hand data
        to anyone outside this list without telling the owner, except where required by law.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Call transcripts, task records, and guardrail logs are kept for as long as the owner&apos;s account is active, so
        the owner can review their own call and task history. An owner can delete their account and associated data,
        or ask us to, at any time by contacting us below.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li><strong>Owners</strong> can review, edit, or delete their profile, facts, connected integrations, and call/task history from the dashboard, or disconnect any integration at any time.</li>
        <li><strong>Callers and counterparts</strong> who want a copy of, or to have deleted, data from a specific call can contact the owner directly, or reach us at the email below and we&apos;ll pass the request along.</li>
      </ul>

      <h2>Children&apos;s privacy</h2>
      <p>Perrie is not directed at children under 13, and we do not knowingly collect personal data from them.</p>

      <h2>Security</h2>
      <p>
        We apply reasonable technical and organizational safeguards (access controls, encrypted transport, and the
        guardrails described above) to protect data in transit and at rest. No system is perfectly secure, and we
        can&apos;t guarantee absolute security.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we materially change how we collect or use data, we&apos;ll update this page and change the
        &ldquo;Last updated&rdquo; date above.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions about this policy, or requests regarding your data, can be sent to{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
      <p className="text-xs text-[color:var(--color-slate)]/55">
        {LEGAL_ENTITY_NAME} operates Perrie. Replace the placeholders in this document (entity name, contact email,
        jurisdiction) with your real details before publishing.
      </p>
    </LegalPageLayout>
  );
}
