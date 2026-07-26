import { AgentShell } from "@/components/layout/AgentShell";
import { AgentToaster } from "@/components/agent/AgentToaster";
import { ChainDeclineBanner } from "@/components/agent/ChainDeclineBanner";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AgentInstallPrompt } from "@/components/agent/AgentInstallPrompt";
import { resolveAgentSession } from "@/lib/agent-session";
import { shouldSeeKineticShell } from "@/lib/kinetic/flag";
import "./styles/themes.css";
import "./styles/agent-system.css";
import "./styles/kinetic-shell.css";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const { session, isInternalStaff, showWelcome, theme, mobileTheme, nightModePref, chainDeclineNotif, agencyModeProfile } =
    await resolveAgentSession();

  const kineticEnabled = shouldSeeKineticShell(session);

  return (
    <div data-theme={theme} style={{ display: "contents" }}>
      <AgentToaster>
        <AgentShell session={session} showWelcome={showWelcome} theme={theme} mobileTheme={mobileTheme} nightModePref={nightModePref} agencyModeProfile={agencyModeProfile} kineticEnabled={kineticEnabled}>
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
