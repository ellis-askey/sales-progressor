import { AgentShell } from "@/components/layout/AgentShell";
import { AgentToaster } from "@/components/agent/AgentToaster";
import { ChainDeclineBanner } from "@/components/agent/ChainDeclineBanner";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AgentInstallPrompt } from "@/components/agent/AgentInstallPrompt";
import { resolveAgentSession } from "@/lib/agent-session";
import { shouldSeeKineticShell } from "@/lib/kinetic/flag";
import { agencyUserHasSelfManagedFiles } from "@/lib/agent/self-managed-nav";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { AppBackground } from "@/components/decor/AppBackground";
import { GlassPicksProvider } from "@/lib/glass/context";
import "./styles/themes.css";
import "./styles/agent-system.css";
import "./styles/kinetic-shell.css";
// Elevra-backgrounds pass, 2026-08-08. Page-level backgrounds keyed on
// [data-theme="light|dark"] on <html>. Coexists with the shell's
// data-theme={"sunset"|...} on .agent-shell-root (different selector,
// different token names). Cards still read --agent-* tokens.
import "@/app/styles/elevra.css";
// Design Lab (Ellis-only) — 22 glass variant classes + v00 baseline.
// Dormant until GlassCard consumers land in commit C. See file docstring.
import "@/app/styles/glass.css";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const { session, isInternalStaff, showWelcome, theme, mobileTheme, nightModePref, themeMode, glassPicks, chainDeclineNotif, agencyModeProfile } =
    await resolveAgentSession();

  const kineticEnabled = shouldSeeKineticShell(session);

  // Gates the Reminders + Auto-emails nav items (see helper docstring).
  const hasSelfManagedFiles = await agencyUserHasSelfManagedFiles(
    session.user.role,
    session.user.id,
    session.user.agencyId,
  );

  return (
    <div data-theme={theme} style={{ display: "contents" }}>
      {/* Inline script runs BEFORE React hydrates — sets data-theme +
          elevra-bg on <html> so first paint has the right background. */}
      <ThemeModeBoot initialMode={themeMode} />
      {/* WebGL backdrop: SoftAurora on dark, Iridescence on light,
          CSS fallback on iOS. Reads data-theme on <html> and swaps live. */}
      <AppBackground />
      {/* Design Lab (Ellis-only) — provides per-card glass-variant picks
          via context. Empty for anyone who hasn't set picks, so their
          tagged cards render as their defaultVariant (v00 = today). */}
      <GlassPicksProvider initialPicks={glassPicks}>
      <AgentToaster>
        <AgentShell session={session} showWelcome={showWelcome} theme={theme} mobileTheme={mobileTheme} nightModePref={nightModePref} themeMode={themeMode} agencyModeProfile={agencyModeProfile} kineticEnabled={kineticEnabled} hasSelfManagedFiles={hasSelfManagedFiles}>
          {chainDeclineNotif && (
            <div style={{ padding: "16px 24px 0" }}>
              <ChainDeclineBanner address={chainDeclineNotif} />
            </div>
          )}
          {children}
        </AgentShell>
        {!isInternalStaff && <FeedbackWidget checklistAware userId={session.user.id} />}
        <AgentInstallPrompt />
      </AgentToaster>
      </GlassPicksProvider>
    </div>
  );
}
