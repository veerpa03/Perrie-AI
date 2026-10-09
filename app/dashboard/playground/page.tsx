import Playground from "@/components/dashboard/Playground";
import { PageHeader } from "@/components/dashboard/ui";
import { getProfile, ownerName } from "@/server/db";
import { env } from "@/server/env";

export const metadata = { title: "Playground — Perrie" };

export default async function PlaygroundPage() {
  const profile = await getProfile();
  return (
    <>
      <PageHeader
        eyebrow="Playground"
        title="Talk to Perrie"
        subtitle="Rehearse calls by typing. Play yourself, a stranger trying to pry, or the person Perrie is calling — and watch the guardrails hold."
      />
      {!env.anthropic() && (
        <p className="mb-6 rounded-2xl bg-[#FFF0D6] px-4 py-3 text-sm font-bold text-[#A2620F]" role="note">
          Add ANTHROPIC_API_KEY to .env.local to get replies. Greetings work without it.
        </p>
      )}
      <Playground ownerName={ownerName(profile)} assistantName={profile?.assistant_name ?? "Perrie"} />
    </>
  );
}
