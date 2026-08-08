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

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAgentTheme, getMobileAgentTheme } from "@/lib/agent/themes";
import { ProfileFormPlain } from "@/components/account/v2/ProfileFormPlain";
import { ThemePickerPlain } from "@/components/account/v2/ThemePickerPlain";
import { AccountDangerZonePlain } from "@/components/account/v2/AccountDangerZonePlain";
import { SendingAddressesSection } from "@/components/verified-emails/SendingAddressesSection";

export default async function AccountProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const session = await requireSession();
  const { verified } = await searchParams;

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, agentPreferences: true },
  });
  const currentTheme = getAgentTheme(userRecord?.agentPreferences);
  const currentMobileTheme = getMobileAgentTheme(userRecord?.agentPreferences);

  const HAIRLINE = "0.5px solid rgba(0,0,0,0.08)";

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "32px 24px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      {/* 1. My profile */}
      <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
            My profile
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Update your name, email and phone number.
          </p>
        </div>
        <ProfileFormPlain
          initialName={session.user.name ?? ""}
          initialEmail={session.user.email ?? ""}
          initialPhone={userRecord?.phone ?? ""}
          role={session.user.role}
        />
      </section>

      {/* 2. Branch theme — hidden 2026-08-08 as part of the Elevra-backgrounds
             pass. Six-theme picker (sunset/coastal/…) replaced by the single
             light/dark toggle in the topbar. Preferences remain in the DB and
             the picker source (`ThemePickerPlain`, `themes.css`) is kept for
             a potential revert. To restore: uncomment this section.
        <div style={{ borderTop: HAIRLINE }} />
        <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Branch theme
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              Your personal theme — visible only to you, not your whole branch. Applies instantly.
            </p>
          </div>
          <ThemePickerPlain currentTheme={currentTheme} currentMobileTheme={currentMobileTheme} />
        </section>
        <div style={{ borderTop: HAIRLINE }} />
      */}
      <div style={{ borderTop: HAIRLINE }} />

      {/* 3. Sending addresses */}
      <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Sending addresses
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Verify a work email address to send emails to clients directly from the dashboard.
            Emails appear as coming from you — not a generic system address.
          </p>
        </div>
        <SendingAddressesSection initialVerified={verified === "1"} />
      </section>

      <div style={{ borderTop: HAIRLINE }} />

      {/* 4. Account / danger zone */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Account
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Download a copy of your data, or permanently delete your account.
          </p>
        </div>
        <AccountDangerZonePlain userEmail={session.user.email ?? ""} />
      </section>
    </div>
  );
}
