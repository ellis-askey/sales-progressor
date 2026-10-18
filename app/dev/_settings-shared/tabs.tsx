"use client";

// Shared tab bodies for the two dev settings clones (/dev/settings-account and
// /dev/settings-business). Each mounts the REAL settings components with mock
// props, arranged under the CONSOLIDATED structure from the plan. Dev-only;
// nothing is wired to the app. The `_settings-shared` folder is underscore-
// prefixed so Next never treats it as a route.

import { DEFAULT_PUSH_PREFS, type NotificationPrefs } from "@/lib/agent/notification-prefs";
import { ArrowSquareOut, Info } from "@phosphor-icons/react";

import { BusinessAutomationForm } from "@/components/progression/BusinessAutomationForm";
import { AgencyChaseGrid } from "@/components/automation/AgencyChaseGrid";
import { AutomationSettingsForm } from "@/components/automation/AutomationSettingsForm";
import { ClientPortalSettings } from "@/components/account/client-portal/ClientPortalSettings";
import { EmailNotificationsSectionPlain } from "@/components/account/v2/EmailNotificationsSectionPlain";
import { MobilePushSection } from "@/components/agent/settings/MobilePushSection";
import { SilencedFilesSectionPlain } from "@/components/account/v2/SilencedFilesSectionPlain";
import { FinalEmailWorkspace } from "@/app/dev/settings-plan/_final/EmailWorkspace";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { PlanTermsCollapsed } from "@/components/billing/v2/PlanTermsCollapsed";
// Admin tabs (unchanged by the plan, but mounted real for full fidelity)
import { ProfileFormPlain } from "@/components/account/v2/ProfileFormPlain";
import { BrandColorPicker } from "@/components/account/v2/BrandColorPicker";
import { WritingStyleCard } from "@/components/account/v2/WritingStyleCard";
import { AccountDangerZonePlain } from "@/components/account/v2/AccountDangerZonePlain";
import { AgencyNameForm } from "@/components/account/v2/AgencyNameForm";
import { TeamManagementPlain } from "@/components/account/v2/TeamManagementPlain";
import { EmailSignatureCard } from "@/components/account/v2/EmailSignatureCard";
import { ChangePasswordCard } from "@/components/account/v2/ChangePasswordCard";
import { TwoFactorCard } from "@/components/account/v2/TwoFactorCard";
import { SessionsCard } from "@/components/account/v2/SessionsCard";
import { AccountConnectionsCard } from "@/components/account/AccountConnectionsCard";
import { ImapConnectionCard } from "@/components/account/ImapConnectionCard";
import { WhatsAppConnectionCard } from "@/components/account/WhatsAppConnectionCard";

// ── Mock data ─────────────────────────────────────────────────────────────────
const PREFS: NotificationPrefs = {
  morningDigest: true, weeklyBrief: true, clientConfirmationEmails: true,
  chainEmails: true, appointmentReminders: true, retentionEmails: false,
  push: DEFAULT_PUSH_PREFS,
};
const PORTAL = { showPortalKeyDates: true, showPortalCosts: true, showPortalProgressPercent: true, showPortalWelcomeSheet: true };
const BIZ_AUTO = { client: true, solicitor: true, enquiries: true, weekly: false, chain: true, autoChainInvites: true };
const RULES = [
  { milestoneCode: "VM1", milestoneName: "Seller has instructed their solicitor", side: "vendor" as const, orderIndex: 1, graceDays: 2, repeatEveryDays: 3, defaultGraceDays: 2, defaultRepeatEveryDays: 3, escalateAfterChases: 2, escalateOverridden: false, enabled: true },
  { milestoneCode: "VM7", milestoneName: "Seller's solicitor has issued the draft contract pack", side: "vendor" as const, orderIndex: 7, graceDays: 5, repeatEveryDays: 3, defaultGraceDays: 5, defaultRepeatEveryDays: 3, escalateAfterChases: 2, escalateOverridden: false, enabled: true },
  { milestoneCode: "VM16", milestoneName: "Seller's solicitor has issued contract documents to the seller", side: "vendor" as const, orderIndex: 16, graceDays: 3, repeatEveryDays: 5, defaultGraceDays: 3, defaultRepeatEveryDays: 5, escalateAfterChases: 2, escalateOverridden: false, enabled: true },
  { milestoneCode: "PM4", milestoneName: "Buyer has paid money on account to their solicitor", side: "purchaser" as const, orderIndex: 4, graceDays: 5, repeatEveryDays: 5, defaultGraceDays: 5, defaultRepeatEveryDays: 5, escalateAfterChases: 2, escalateOverridden: false, enabled: true },
  { milestoneCode: "PM8", milestoneName: "Buyer's solicitor has ordered searches", side: "purchaser" as const, orderIndex: 8, graceDays: 3, repeatEveryDays: 3, defaultGraceDays: 3, defaultRepeatEveryDays: 3, escalateAfterChases: 2, escalateOverridden: false, enabled: true },
  { milestoneCode: "PM20", milestoneName: "Buyer's solicitor has confirmed all enquiries are now satisfied", side: "purchaser" as const, orderIndex: 20, graceDays: 28, repeatEveryDays: 7, defaultGraceDays: 28, defaultRepeatEveryDays: 7, escalateAfterChases: 2, escalateOverridden: false, enabled: true },
];
const SILENCED = [
  { id: "d1", propertyAddress: "24 Willow Close, Ashford, TN23 4AB", pausedAt: new Date("2026-10-10T09:00:00Z"), pausedByName: "Ellis Askey" },
  { id: "d2", propertyAddress: "2 The Courtyard, Leighton Buzzard, LU7 0GY", pausedAt: new Date("2026-10-08T09:00:00Z"), pausedByName: "Taylor Kay" },
];

// ── Header (mirrors AccountPageHeader shape) ──────────────────────────────────
export function DevHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 740, letterSpacing: "-.02em", color: "var(--agent-text-primary)" }}>{title}</h1>
      <p style={{ margin: "6px 0 0", fontSize: 14.5, color: "var(--agent-text-secondary)", maxWidth: "62ch" }}>{sub}</p>
    </div>
  );
}

const changedNote: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600,
  color: "var(--agent-coral-deep)", background: "var(--agent-coral-bg-tint)",
  border: "1px solid rgba(var(--agent-coral-rgb),.25)", borderRadius: 9, padding: "7px 12px", width: "fit-content",
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function EmailsTab() {
  return (
    <>
      <DevHeader title="Emails" sub="Your client emails, in one place: what they say, how they look, who they come from, and which go out." />
      <div style={changedNote}><Info size={14} weight="fill" /> Consolidated: copy + Studio + sender, one workspace with a live preview.</div>
      <FinalEmailWorkspace />
    </>
  );
}

export function ChasingTab({ business = false }: { business?: boolean }) {
  return (
    <>
      <DevHeader title="Automated chasing" sub="Which chases we run, and how often. These apply to every file unless you change them on an individual sale." />
      <div style={changedNote}><Info size={14} weight="fill" /> New single home: absorbs the orphaned automation page, enquiry toggle, weekly + chain toggles.</div>
      {business
        ? <BusinessAutomationForm initial={BIZ_AUTO} />
        : <AgencyChaseGrid initial={{ client: true, solicitor: true, enquiries: true, weekly: false, chain: true }} />}
      <AutomationSettingsForm initialChaseEmailsEnabled initialRules={RULES} initialEscalateAfter={2} scope={business ? "business" : "agency"} showMasterToggle={false} />
    </>
  );
}

export function ClientsTab() {
  return (
    <>
      <DevHeader title="What clients see" sub="Switch any of these off to hide them across all client portals. You can still override them on an individual sale." />
      <ClientPortalSettings initial={PORTAL} />
    </>
  );
}

export function NotificationsTab() {
  return (
    <>
      <DevHeader title="Notifications" sub="How and when we notify you. Your in-app bell shows everything; these control what is also emailed or pushed to you." />
      <div style={changedNote}><Info size={14} weight="fill" /> Changed: the editable &ldquo;Silenced files&rdquo; control moves to the file; here it is a read-only roster.</div>
      <EmailNotificationsSectionPlain initialPrefs={PREFS} />
      <MobilePushSection initialPrefs={PREFS} initialDevices={[]} />
      <SilencedFilesSectionPlain initialSilenced={SILENCED} />
    </>
  );
}

export function ProfileTab({ owner = false }: { owner?: boolean }) {
  return (
    <>
      <DevHeader title="Profile" sub="Your name, photo, brand colour, and account basics." />
      <div style={changedNote}><Info size={14} weight="fill" /> Changed: email branding moved to the Emails tab (sending address stays here, since negotiators need it too).</div>
      <ProfileFormPlain initialName="Ellis Askey" initialEmail="ellis@example.com" initialPhone="" role="director" roleLabel={owner ? "Owner" : "Director"} hideRoleNote={owner} />
      <BrandColorPicker initialColor="#FF6B4A" />
      <EmailSignatureCard initial={{ mode: "BASIC", imageUrl: null, customHtml: null, previewHtml: "<p style='font-size:13px;color:#374151;margin:0'>Ellis Askey<br/>Your agency</p>", missing: [], source: "other" }} />
      <WritingStyleCard profile={null} builtAt={null} />
      <AccountDangerZonePlain userEmail="ellis@example.com" />
    </>
  );
}

export function TeamTab({ owner = false }: { owner?: boolean }) {
  return (
    <>
      <DevHeader title="Team" sub={owner ? "The people in your business and what they can do." : "The people in your agency and what they can do."} />
      <AgencyNameForm initialName={owner ? "Your business" : "Your agency"} />
      <TeamManagementPlain currentUserId="demo" />
    </>
  );
}

export function SecurityTab() {
  return (
    <>
      <DevHeader title="Security" sub="Your password, sign-in, and sessions." />
      <ChangePasswordCard />
      <TwoFactorCard />
      <SessionsCard />
    </>
  );
}

export function ConnectionsTab() {
  return (
    <>
      <DevHeader title="Connections" sub="Connect your inbox and messaging so updates flow into your files." />
      <AccountConnectionsCard />
      <ImapConnectionCard />
      <WhatsAppConnectionCard />
    </>
  );
}

const MOCK_TERMS = {
  versionTag: "2026-08",
  acknowledgedAt: new Date("2026-10-15T09:00:00Z"),
  sections: [
    { heading: "Charges", body: "Self-progress is free. For a sale you pass to our team to progress, the fee is £250, £300 or £350 depending on the sale price band." },
    { heading: "Free sales", body: "Your first sale sent to our team to progress is free." },
  ],
};

// Shows the three progressor scenarios so the plan card's behaviour is visible
// without a director login (the real billing page is director-only).
export function BillingTab() {
  const noCardNote = (
    <AccountCard>
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>Payment method</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>No payment method needed. Your self-progress is free, and files you send to a progression company are billed by them directly, not by TSP.</p>
        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.55 }}>You&apos;d only need a card if you sent a sale to TSP&apos;s own team to progress.</p>
      </section>
    </AccountCard>
  );
  const scenario = (label: string, progressors: { name: string; rate: string }[]) => (
    <div>
      <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, color: "var(--agent-text-muted)", marginBottom: 7 }}>{label}</div>
      <AccountCard><PlanTermsCollapsed agreed={MOCK_TERMS} progressors={progressors} /></AccountCard>
    </div>
  );
  return (
    <>
      <DevHeader title="Billing" sub="How the Plan &amp; terms card and the payment method adapt when an agency works with external progression companies." />
      <div style={changedNote}><Info size={14} weight="fill" /> Changed: the Outsourced line + payment method now reflect the agency&rsquo;s real progressors, not TSP&rsquo;s own price.</div>
      {scenario("No external progressor — TSP's own pricing (unchanged)", [])}
      {scenario("One progression company — their rate", [{ name: "Boardwalk Progression", rate: "£250 per sale" }])}
      {scenario("Two progression companies — each listed", [{ name: "Boardwalk Progression", rate: "£250 per sale" }, { name: "Meldone", rate: "£250–£550 by band" }])}
      <div>
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, color: "var(--agent-text-muted)", marginBottom: 7 }}>Payment method when they only use external progressors + self-progress</div>
        {noCardNote}
      </div>
    </>
  );
}

export function UnchangedTab({ title, sub, liveHref }: { title: string; sub: string; liveHref: string }) {
  return (
    <>
      <DevHeader title={title} sub={sub} />
      <div style={{ background: "#fff", border: "1px solid var(--agent-border-default)", borderRadius: 14, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 8 }}>
          <Info size={15} weight="fill" style={{ color: "var(--agent-info)" }} /> Unchanged by this plan
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          This tab keeps its current component and behaviour; the consolidation only aligns where it sits in the menu. Review it live:
        </p>
        <a href={liveHref} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 650, color: "var(--agent-coral-deep)", textDecoration: "none", border: "1.5px solid var(--agent-border-default)", borderRadius: 9, padding: "8px 13px" }}>
          <ArrowSquareOut size={14} weight="bold" /> Open the live {title} tab
        </a>
      </div>
    </>
  );
}
