// app/(account)/agent/account/emails/page.tsx
//
// Account → Emails. A director personalises the wording their buyers and
// sellers receive. Sales Progressor copy is the default; an edit saves the
// agency's own version, layered on top, from the next send. Director-only.
// Client-facing copy only — solicitor and internal emails stay ours.
//
// Redesign: "Step-by-step updates" (the milestone editor) and "Automated
// emails" (a compact list whose rows open the editor in a right-side drawer)
// as cards.

import { notFound } from "next/navigation";
import { resolveAgentSession } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";
import { buildStepList } from "@/lib/milestone-emails/steps";
import { getBrandColor } from "@/lib/agent/themes";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { getProgressorCopy } from "@/lib/progression/inviting";
import { resolveStudioTheme } from "@/lib/email/email-theme-studio";
import { emailStudioEnabled } from "@/lib/email/studio-flag";
import { AgencyMilestoneEmailsEditor } from "@/components/account/emails/AgencyMilestoneEmailsEditor";
import { AutomatedEmailsList } from "@/components/account/emails/AutomatedEmailsList";
import { EmailStudio } from "@/components/account/v2/EmailStudio";
import { EmailBrandingStudio, type BrandingInitial } from "@/components/account/v2/EmailBrandingStudio";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { EmailsTabs } from "@/components/account/emails/EmailsTabs";
import Link from "next/link";
import { ShareNetwork, EnvelopeSimple, Info, Image as ImageIcon, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function AccountEmailsPage() {
  const { session } = await resolveAgentSession();
  if (session.user.role !== "director" || !session.user.agencyId) notFound();

  // Client-facing steps only (buyer/seller copy); strip agent/internal sides.
  const steps = buildStepList()
    .filter((s) => s.sides.includes("vendor") || s.sides.includes("purchaser"))
    .map((s) => ({ ...s, sides: s.sides.filter((x) => x === "vendor" || x === "purchaser") }));

  // Agency email branding (moved here from Profile so the whole email life -
  // wording + look - lives on one tab). Director-level, agency-wide.
  const [userRecord, agency] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { agentPreferences: true } }),
    prisma.agency.findUnique({
      where: { id: session.user.agencyId },
      select: { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true, emailTheme: true },
    }),
  ]);
  const currentBrand = getBrandColor(userRecord?.agentPreferences);
  const branding: BrandingInitial = {
    logoUrl: getAgencyLogoUrl(agency?.logoPath),
    tileColor: agency?.logoTileColor ?? null,
    scale: (agency?.logoScale as BrandingInitial["scale"]) ?? null,
    align: (agency?.logoAlign as BrandingInitial["align"]) ?? null,
    theme: (agency?.emailTheme as BrandingInitial["theme"]) ?? null,
    appAccent: currentBrand ?? null,
  };
  const agencyName = agency?.name ?? null;

  // Wording applies to the sales the agency progresses itself (and any our own
  // team handles); sales outsourced to an external company use that company's
  // wording instead. Only surface that split to agencies that actually work
  // with a progression company, so a self-managed agency keeps the simple note.
  const progressors = await getProgressorCopy(session.user.agencyId);
  const wordingNote =
    progressors.count === 0
      ? "Changes take effect from the next email. Anything you leave unchanged keeps our original wording."
      : progressors.count === 1 && progressors.name
        ? `Changes take effect from the next email on sales you progress yourself. Sales sent to ${progressors.name} use their wording instead. Your branding stays on every email.`
        : "Changes take effect from the next email on sales you progress yourself. Sales sent to a progression company use their wording instead. Your branding stays on every email.";

  // Resolve the agency's full email look so the Words preview renders through the
  // SAME engine as the Style tab — the milestone email shows byte-for-byte in the
  // branding the director chose, not a simplified mock.
  const st = resolveStudioTheme(branding.theme);
  const emailLook = {
    st: { ...st, logoMode: (branding.logoUrl ? "logo" : st.logoMode) as typeof st.logoMode },
    logoUrl: branding.logoUrl,
    tileColor: branding.tileColor ?? "#ffffff",
    identityName: agencyName ?? "Your agency",
  };

  return (
    <>
      <AccountPageHeader
        title="Your client emails"
        subtitle="Every email is ready to go. Customise any of them and we'll use your version instead."
      />
      <EmailsTabs
        words={
          <>
            <AccountCard
              icon={<ShareNetwork size={18} weight="bold" />}
              title="Step-by-step updates"
              subtitle="The email your client receives as each stage of their sale is completed."
            >
              <AgencyMilestoneEmailsEditor steps={steps} look={emailLook} />
            </AccountCard>

            <AccountCard
              icon={<EnvelopeSimple size={18} weight="bold" />}
              title="Automated emails"
              subtitle="Longer emails sent at key moments in the sale."
            >
              <AutomatedEmailsList />
            </AccountCard>

            <AccountCard style={{ background: "rgba(37,99,235,0.04)" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <Info size={20} weight="fill" style={{ color: "#2563eb", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#111827" }}>Your version is what clients see</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#6b7280", lineHeight: 1.5 }}>
                    {wordingNote}
                  </p>
                </div>
              </div>
            </AccountCard>
          </>
        }
        style={
          <AccountCard
            icon={<ImageIcon size={18} weight="bold" />}
            title="Email branding"
            subtitle="Your logo and colours at the top of the emails your clients receive."
          >
            {emailStudioEnabled(session.user.email) ? (
              <EmailStudio initial={branding} identityName={agencyName ?? "Your agency"} />
            ) : (
              <EmailBrandingStudio initial={branding} />
            )}
          </AccountCard>
        }
        sender={
          <AccountCard
            icon={<PaperPlaneTilt size={18} weight="bold" />}
            title="Sending address"
            subtitle="The email address your clients receive messages from."
          >
            <p style={{ margin: 0, fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>
              Each team member can send from their own work email, so sending addresses are managed individually under{" "}
              <Link href="/agent/account/profile" style={{ color: "var(--agent-coral-deep, #E2452A)", fontWeight: 600, textDecoration: "none" }}>
                Profile
              </Link>{" "}
              → Sending addresses.
            </p>
          </AccountCard>
        }
      />
    </>
  );
}
