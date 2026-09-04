// app/(account)/agent/account/profile/page.tsx
//
// Profile tab — Stage 2. Both roles. Re-houses four sections from the
// legacy /agent/settings page onto the Account/Profile canvas, restyled
// to the clean Account register. Wiring is sacred: each section uses the
// same server actions and onboarding-event contract as the live page.
//
// Sections (in render order):
//   1. My profile        — ProfileFormPlain (clone of ProfileForm)
//   2. Branch theme      — ThemePickerPlain (reuses original tile renderers)
//   3. Sending addresses — SendingAddressesSection (reused as-is, same
//                          component used by /agent/settings; its
//                          router.replace target now points here)
//   4. Account           — AccountDangerZonePlain (data export + delete,
//                          danger zone at the bottom)
//
// searchParams: ?verified=1 lands here when an email-link verification
// succeeds (verify-link API redirect target). Passed to
// SendingAddressesSection as initialVerified for the success banner.
//
// The legacy /agent/settings page continues to render the same four
// sections (plus team/automation/etc.) until Stage 4 retire.

import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getBrandColor } from "@/lib/agent/themes";
import { ProfileFormPlain } from "@/components/account/v2/ProfileFormPlain";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { BrandColorPicker } from "@/components/account/v2/BrandColorPicker";
import { AccountDangerZonePlain } from "@/components/account/v2/AccountDangerZonePlain";
import { WritingStyleCard } from "@/components/account/v2/WritingStyleCard";
import { SendingAddressesSection } from "@/components/verified-emails/SendingAddressesSection";
import { EmailBrandingStudio, type BrandingInitial } from "@/components/account/v2/EmailBrandingStudio";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Palette, Image as ImageIcon, EnvelopeSimple, Database } from "@phosphor-icons/react/dist/ssr";

export default async function AccountProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const session = await requireSession();
  const { verified } = await searchParams;

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      phone: true, jobTitle: true, directMobile: true, agentPreferences: true, image: true,
      chaseVoiceProfile: true, chaseVoiceProfileBuiltAt: true,
    },
  });
  const currentBrand = getBrandColor(userRecord?.agentPreferences);

  // Agency logo is a director-level, agency-wide brand setting (client emails).
  const isDirector = session.user.role === "director";
  let branding: BrandingInitial | null = null;
  if (isDirector && session.user.agencyId) {
    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId },
      select: { logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true },
    });
    branding = {
      logoUrl: getAgencyLogoUrl(agency?.logoPath),
      tileColor: agency?.logoTileColor ?? null,
      scale: (agency?.logoScale as BrandingInitial["scale"]) ?? null,
      align: (agency?.logoAlign as BrandingInitial["align"]) ?? null,
    };
  }

  const colourCard = (
    <AccountCard
      icon={<Palette size={18} weight="bold" />}
      title="Your app colour"
      subtitle="Choose the accent colour you'll see across Sales Progressor."
    >
      <BrandColorPicker initialColor={currentBrand} />
    </AccountCard>
  );

  const sendingCard = (
    <AccountCard
      icon={<EnvelopeSimple size={18} weight="bold" />}
      title="Sending addresses"
      subtitle="Send emails to clients directly from your own work address."
    >
      <SendingAddressesSection initialVerified={verified === "1"} />
    </AccountCard>
  );

  const accountCard = (
    <AccountCard
      icon={<Database size={18} weight="bold" />}
      title="Account & data"
      subtitle="Manage your data or permanently delete your account."
    >
      <AccountDangerZonePlain userEmail={session.user.email ?? ""} />
    </AccountCard>
  );

  const emailCard = isDirector && branding ? (
    <AccountCard
      icon={<ImageIcon size={18} weight="bold" />}
      title="Email branding"
      subtitle="Your logo appears at the top of emails your clients receive."
    >
      <EmailBrandingStudio initial={branding} />
      <p style={{ margin: "16px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "#6b7280" }}>
        Want to change the wording in your emails?{" "}
        <Link
          href="/agent/account/emails"
          style={{ color: "var(--agent-coral-deep, #E2452A)", fontWeight: 600, textDecoration: "none" }}
        >
          Email settings <LinkArrow />
        </Link>
      </p>
    </AccountCard>
  ) : null;

  return (
    <>
      <AccountPageHeader
        title="Profile"
        subtitle="Manage your personal details and app preferences."
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
        />

        <WritingStyleCard
          profile={userRecord?.chaseVoiceProfile ?? null}
          builtAt={userRecord?.chaseVoiceProfileBuiltAt?.toISOString() ?? null}
        />

        {emailCard ? (
          // Desktop: email branding on the right; colour, sending, account
          // stacked on the left. Mobile (1 col): colour, email, sending,
          // account — the same order as before.
          <div className="profile-grid">
            <div style={{ gridArea: "colour" }}>{colourCard}</div>
            <div style={{ gridArea: "email" }}>{emailCard}</div>
            <div style={{ gridArea: "sending" }}>{sendingCard}</div>
            <div style={{ gridArea: "account" }}>{accountCard}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {colourCard}
            {sendingCard}
            {accountCard}
          </div>
        )}
      </div>

      <style>{`
        .profile-grid {
          display: grid;
          gap: 24px;
          align-items: start;
          grid-template-columns: 1fr 1fr;
          grid-template-areas:
            "colour  email"
            "sending email"
            "account email";
        }
        @media (max-width: 1024px) {
          .profile-grid {
            grid-template-columns: 1fr;
            grid-template-areas:
              "colour"
              "email"
              "sending"
              "account";
          }
        }
      `}</style>
    </>
  );
}
