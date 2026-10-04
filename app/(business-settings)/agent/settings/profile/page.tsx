// /agent/settings/profile — the owner's personal details, mirroring the agency
// Profile tab but with only the per-user cards (no agency-level branding, which
// is agency-bound). Email branding + sending addresses for the business land on
// the business's Emails tab in PR3. Owner-gated.

import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { getBrandColor } from "@/lib/agent/themes";
import { ProfileFormPlain } from "@/components/account/v2/ProfileFormPlain";
import { BrandColorPicker } from "@/components/account/v2/BrandColorPicker";
import { AccountDangerZonePlain } from "@/components/account/v2/AccountDangerZonePlain";
import { WritingStyleCard } from "@/components/account/v2/WritingStyleCard";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Palette, Database } from "@phosphor-icons/react/dist/ssr";

export default async function BusinessProfilePage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      phone: true, jobTitle: true, directMobile: true, agentPreferences: true, image: true,
      chaseVoiceProfile: true, chaseVoiceProfileBuiltAt: true,
    },
  });
  const currentBrand = getBrandColor(userRecord?.agentPreferences);

  return (
    <>
      <AccountPageHeader
        title="Profile"
        subtitle="Manage your personal details and app preferences."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <ProfileFormPlain
          initialName={session.user.name ?? ""}
          initialEmail={session.user.email ?? ""}
          initialPhone={userRecord?.phone ?? ""}
          initialJobTitle={userRecord?.jobTitle ?? ""}
          initialDirectMobile={userRecord?.directMobile ?? ""}
          initialImage={userRecord?.image ?? null}
          role={session.user.role}
          roleLabel="Owner"
          hideRoleNote
        />

        <WritingStyleCard
          profile={userRecord?.chaseVoiceProfile ?? null}
          builtAt={userRecord?.chaseVoiceProfileBuiltAt?.toISOString() ?? null}
        />

        <AccountCard
          icon={<Palette size={18} weight="bold" />}
          title="Your app colour"
          subtitle="Choose the accent colour you'll see across Sales Progressor."
        >
          <BrandColorPicker initialColor={currentBrand} />
        </AccountCard>

        <AccountCard
          icon={<Database size={18} weight="bold" />}
          title="Account & data"
          subtitle="Manage your data or permanently remove your account."
        >
          <AccountDangerZonePlain userEmail={session.user.email ?? ""} />
        </AccountCard>
      </div>
    </>
  );
}
