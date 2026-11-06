// /agent/settings/profile — the owner's personal details, mirroring the agency
// Profile tab but with only the per-user cards (no agency-level branding, which
// is agency-bound). Email branding + sending addresses for the business land on
// the business's Emails tab in PR3. Owner-gated.

import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessMember } from "@/lib/services/progression-clients";
import { getAppColour } from "@/lib/agent/themes";
import { ProfileFormPlain } from "@/components/account/v2/ProfileFormPlain";
import { AppColourStudioLive } from "@/components/account/v2/AppColourStudioLive";
import { AccountDangerZonePlain } from "@/components/account/v2/AccountDangerZonePlain";
import { WritingStyleCard } from "@/components/account/v2/WritingStyleCard";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { EmailSignatureCard, type SignatureInitial } from "@/components/account/v2/EmailSignatureCard";
import { resolveEmailSignature } from "@/lib/email/signature";
import { getSignatureImageUrl } from "@/lib/supabase-storage";
import { detectSignatureSource } from "@/lib/email/signature-source";
import { Palette, Database } from "@phosphor-icons/react/dist/ssr";

export default async function BusinessProfilePage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const member = await resolveBusinessMember(session);
  if (!member) notFound();

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      phone: true, jobTitle: true, directMobile: true, agentPreferences: true, image: true,
      chaseVoiceProfile: true, chaseVoiceProfileBuiltAt: true,
      emailSignatureMode: true, emailSignatureImagePath: true, emailSignatureHtml: true,
    },
  });
  const currentAppColour = getAppColour(userRecord?.agentPreferences);

  // Email signature for the progression company user — per-user, applied to the
  // emails they send (chases etc.), NOT the agency's client-facing sale emails.
  // No agency logo band (business users aren't agency-bound).
  const sigPreview = await resolveEmailSignature({
    userId: session.user.id,
    agency: null,
    fallbackName: session.user.name,
  });
  const signatureInitial: SignatureInitial = {
    mode: userRecord?.emailSignatureMode ?? "BASIC",
    imageUrl: getSignatureImageUrl(userRecord?.emailSignatureImagePath),
    customHtml: userRecord?.emailSignatureHtml ?? null,
    previewHtml: sigPreview.html,
    missing: sigPreview.missing,
    source: detectSignatureSource(userRecord?.emailSignatureHtml ?? ""),
  };

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
          roleLabel={member.isOwner ? "Owner" : "Team member"}
          hideRoleNote
        />

        <WritingStyleCard
          profile={userRecord?.chaseVoiceProfile ?? null}
          builtAt={userRecord?.chaseVoiceProfileBuiltAt?.toISOString() ?? null}
        />

        <EmailSignatureCard initial={signatureInitial} />

        <AccountCard
          icon={<Palette size={18} weight="bold" />}
          title="Your app colour"
          subtitle="Set your colours, then design your buttons down to the detail."
        >
          <AppColourStudioLive initial={currentAppColour} />
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
