import type { Metadata, Viewport } from "next";
import { AgentShell } from "@/components/layout/AgentShell";
import { AgentToaster } from "@/components/agent/AgentToaster";
import { ChainDeclineBanner } from "@/components/agent/ChainDeclineBanner";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AgentInstallPrompt } from "@/components/agent/AgentInstallPrompt";
import { resolveAgentSession } from "@/lib/agent-session";
import { agencyUserHasSelfManagedFiles } from "@/lib/agent/self-managed-nav";
import { computeNavBadgeCounts } from "@/lib/agent/nav-badges";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessMember, businessHasClients } from "@/lib/services/progression-clients";
import { getProgressorWelcomeState } from "@/lib/services/progressor-chase-prefs";
import { getAgentChasePrefs } from "@/lib/services/agent-chase-prefs";
import { ProgressorWelcomeModal } from "@/components/agent/ProgressorWelcomeModal";
import { SelfManagedWelcomeModal } from "@/components/agent/SelfManagedWelcomeModal";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { ThemeModeReapply } from "@/components/theme/ThemeModeReapply";
import { AppBackground } from "@/components/decor/AppBackground";
import { GlassPicksProvider } from "@/lib/glass/context";
import { PageFadeIn } from "@/components/loading/PageFadeIn";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "./styles/themes.css";
import "./styles/agent-system.css";
// Elevra-backgrounds pass, 2026-08-08. Page-level backgrounds keyed on
// [data-theme="light|dark"] on <html>. Coexists with the shell's
// data-theme={"sunset"|...} on .agent-shell-root (different selector,
// different token names). Cards still read --agent-* tokens.
import "@/app/styles/elevra.css";
// Design Lab (Ellis-only) — 22 glass variant classes + v00 baseline.
// Dormant until GlassCard consumers land in commit C. See file docstring.
import "@/app/styles/glass.css";

// Makes the agent app installable as a real PWA: a home-screen app on mobile
// and a standalone window on desktop Chrome/Edge (the "Install" affordance only
// appears once a valid manifest + service worker are present). start_url +
// icons live in public/manifest.json (scope "/"). The iOS home-screen icon is
// served automatically from app/apple-icon.png; Android/desktop use the
// manifest icon. Without this, tapping "Add to home screen" produced a
// generic, unbranded shortcut.
export const viewport: Viewport = {
  themeColor: "#FF6B4A",
};

export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Sales Progressor",
    statusBarStyle: "default",
  },
};

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const { session, isInternalStaff, showWelcome, theme, brandColor, userName, userImage, mobileTheme, nightModePref, themeMode, backgroundOpacity, glassPicks, chainDeclineNotif, agentBellClearedAt, agencyModeProfile, progressorName } =
    await resolveAgentSession();
  void theme; void mobileTheme; // legacy preset fields; the app now runs on the custom brand colour


  // Gates the Reminders + Auto-emails nav items (see helper docstring).
  const hasSelfManagedFiles = await agencyUserHasSelfManagedFiles(
    session.user.role,
    session.user.id,
    session.user.agencyId,
  );

  // Nav "needs attention" badges (To-Do, Enquiries, Reminders, Chains,
  // Completions) — each a "your move" count, computed once here for first paint
  // and refetched client-side on navigation so they stay live. See
  // lib/agent/nav-badges.ts.
  const badges = await computeNavBadgeCounts(session, hasSelfManagedFiles);

  // One lookup, two uses. "Clients" nav + new-sale→clients stay owner-only
  // (showClientsNav). isBusinessMember (owner OR team) points the Account link at
  // the member's own settings area instead of the blank agency account. The flag
  // is checked first so there is NO extra query in production until switched on.
  const businessMember = progressionBusinessesEnabled() ? await resolveBusinessMember(session) : null;
  const showClientsNav = !!businessMember?.isOwner;
  const isBusinessMember = !!businessMember;
  // A non-owner team member's "New sale" dead-ends (bounces to the hub) until the
  // business has a client to attach a sale to — hide it until then (P1). Owners go
  // via the Clients screen, which is never a dead-end, so they're unaffected.
  const businessMemberHasClients = businessMember && !businessMember.isOwner
    ? await businessHasClients(businessMember.businessId)
    : true;

  // First-run welcome for an external progression-business OWNER (critiques #1+#3).
  // Resolved only for owners (so no extra query for anyone else), and returns null
  // once seen. Agents / TSP staff never qualify.
  const progressorWelcome = businessMember?.isOwner ? await getProgressorWelcomeState(session) : null;

  // First-run 3-step welcome for a SELF-MANAGED agency DIRECTOR (not progressor-
  // managed, not a negotiator). Seeds the chase toggles from the agency's current
  // flags so the welcome reflects reality. Everyone else — negotiators, and agents
  // whose files are progressor-managed — keeps the simpler one-step welcome.
  const selfManagedWelcomePrefs =
    showWelcome && !progressorWelcome && !progressorName && session.user.role === "director" && session.user.agencyId
      ? await getAgentChasePrefs(session.user.agencyId)
      : null;

  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      {/* The user's brand colour, derived into the full token set at render
          (light + dark), overriding the neutral [data-theme="custom"] base. */}
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(brandColor) }} />
      {/* Inline script runs BEFORE React hydrates — sets data-theme +
          elevra-bg on <html> so first paint has the right background. */}
      <ThemeModeBoot initialMode={themeMode} initialAuroraOpacity={backgroundOpacity} />
      {/* Client companion to the boot script: re-establishes <html> theme + bg
          state on client-side navigation into the agent app (the inline boot
          script only runs on a hard load), fixing the dimmed nav when returning
          from the Command Centre. */}
      <ThemeModeReapply initialMode={themeMode} initialAuroraOpacity={backgroundOpacity} />
      {/* WebGL backdrop: SoftAurora on dark, Iridescence on light,
          CSS fallback on iOS. Reads data-theme on <html> and swaps live. */}
      <AppBackground />
      {/* Design Lab (Ellis-only) — provides per-card glass-variant picks
          via context. Empty for anyone who hasn't set picks, so their
          tagged cards render as their defaultVariant (v00 = today). */}
      <GlassPicksProvider initialPicks={glassPicks}>
      <AgentToaster>
        <AgentShell session={session} showWelcome={showWelcome} theme={theme} mobileTheme={mobileTheme} userName={userName} userImage={userImage} nightModePref={nightModePref} themeMode={themeMode} backgroundOpacity={backgroundOpacity} agencyModeProfile={agencyModeProfile} progressorName={progressorName} suppressSimpleWelcome={!!selfManagedWelcomePrefs} hasSelfManagedFiles={hasSelfManagedFiles} todoDueCount={badges.todo} enquiriesOpenCount={badges.enquiries} remindersCount={badges.reminders} chainsCount={badges.chains} completionsCount={badges.completions} agentBellClearedAt={agentBellClearedAt} showClientsNav={showClientsNav} isBusinessMember={isBusinessMember} businessMemberHasClients={businessMemberHasClients}>
          {chainDeclineNotif && (
            <div style={{ padding: "16px 24px 0" }}>
              <ChainDeclineBanner address={chainDeclineNotif} />
            </div>
          )}
          {/* Every agent page fades in on mount + on client-side navigation
              via PageFadeIn (usePathname keys the reset). Same 280ms fade +
              8px translateY as the hub SectionReveal. Layout chrome (topbar,
              sidebar) stays static; only the page content region animates.
              Reduced-motion snaps to visible. 2026-08-10. */}
          <PageFadeIn>{children}</PageFadeIn>
        </AgentShell>
        {!isInternalStaff && <FeedbackWidget checklistAware userId={session.user.id} />}
        {progressorWelcome && (
          <ProgressorWelcomeModal
            businessName={progressorWelcome.businessName}
            userName={userName}
            initialPrefs={progressorWelcome.prefs}
            themeMode={themeMode}
          />
        )}
        {selfManagedWelcomePrefs && (
          <SelfManagedWelcomeModal
            agencyModeProfile={agencyModeProfile ?? "self_progressed"}
            userName={userName}
            initialPrefs={selfManagedWelcomePrefs}
            themeMode={themeMode}
          />
        )}
        <AgentInstallPrompt />
      </AgentToaster>
      </GlassPicksProvider>
    </div>
  );
}
