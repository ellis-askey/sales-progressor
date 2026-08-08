import { AgentShell } from "@/components/layout/AgentShell";
import { AgentToaster } from "@/components/agent/AgentToaster";
import { ChainDeclineBanner } from "@/components/agent/ChainDeclineBanner";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AgentInstallPrompt } from "@/components/agent/AgentInstallPrompt";
import { resolveAgentSession } from "@/lib/agent-session";
import { shouldSeeKineticShell } from "@/lib/kinetic/flag";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { AppBackground } from "@/components/decor/AppBackground";
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
  const { session, isInternalStaff, showWelcome, theme, mobileTheme, nightModePref, themeMode, chainDeclineNotif, agencyModeProfile } =
    await resolveAgentSession();

  const kineticEnabled = shouldSeeKineticShell(session);

  return (
    <div data-theme={theme} style={{ display: "contents" }}>
      {/* Inline script runs BEFORE React hydrates — sets data-theme +
          elevra-bg on <html> so first paint has the right background. */}
      <ThemeModeBoot initialMode={themeMode} />
      {/* WebGL backdrop: SoftAurora on dark, Iridescence on light,
          CSS fallback on iOS. Reads data-theme on <html> and swaps live. */}
      <AppBackground />
      <AgentToaster>
        <AgentShell session={session} showWelcome={showWelcome} theme={theme} mobileTheme={mobileTheme} nightModePref={nightModePref} themeMode={themeMode} agencyModeProfile={agencyModeProfile} kineticEnabled={kineticEnabled}>
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
    </div>
  );
}
