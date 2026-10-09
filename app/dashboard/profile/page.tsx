import { Megaphone } from "lucide-react";
import FactsEditor from "@/components/dashboard/FactsEditor";
import ProfileForm from "@/components/dashboard/ProfileForm";
import { ClayCard, PageHeader } from "@/components/dashboard/ui";
import { getProfile, listFacts, ownerName } from "@/server/db";

export const metadata = { title: "Profile — Perrie" };

function allTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

export default async function ProfilePage() {
  const [profile, facts] = await Promise.all([getProfile(), listFacts()]);
  const tzs = allTimezones();
  const shareable = facts.filter((f) => f.visibility === "shareable");
  const name = ownerName(profile);

  return (
    <>
      <PageHeader
        eyebrow={profile ? "Your profile" : "Step 1"}
        title={profile ? <span className="rainbow-text">{profile.full_name}</span> : "Create your profile"}
        subtitle={
          profile
            ? "Everything Perrie knows about you, and who it's allowed to share it with."
            : "Tell Perrie who it works for. This is what makes it your assistant — and nobody else's."
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <ProfileForm
          isNew={!profile}
          timezones={tzs.includes("UTC") ? tzs : ["UTC", ...tzs]}
          initial={{
            full_name: profile?.full_name ?? "",
            preferred_name: profile?.preferred_name ?? "",
            pronouns: profile?.pronouns ?? "",
            timezone: profile?.timezone ?? "UTC",
            phone_numbers: profile?.phone_numbers ?? [],
            assistant_name: profile?.assistant_name ?? "Perrie",
            assistant_voice: profile?.assistant_voice ?? "",
            rules: profile?.rules ?? [],
            hasPin: !!profile?.pin_hash,
          }}
        />

        <div className="space-y-6">
          <FactsEditor
            disabled={!profile}
            facts={facts.map((f) => ({
              id: f.id,
              category: f.category,
              label: f.label,
              value: f.value,
              visibility: f.visibility,
            }))}
          />

          <ClayCard title="What other callers can hear" icon={Megaphone} accent="sky">
            <p className="-mt-1 mb-3 text-sm text-[color:var(--color-slate)]/70">
              If someone else calls, {profile?.assistant_name ?? "Perrie"} introduces itself as {name}&apos;s assistant,
              offers to take a message, and can share only:
            </p>
            {shareable.length ? (
              <ul className="space-y-1.5 text-sm text-[color:var(--color-slate)]/85">
                {shareable.map((f) => (
                  <li key={f.id} className="flex gap-2">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5BA7DE]" />
                    <span>
                      <strong>{f.label}:</strong> {f.value}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-semibold text-[color:var(--color-slate)]/55">
                Nothing — every fact is private. Callers can only leave a message.
              </p>
            )}
          </ClayCard>
        </div>
      </div>
    </>
  );
}
