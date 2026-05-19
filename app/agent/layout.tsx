import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AgentShell } from "@/components/layout/AgentShell";
import { AgentToaster } from "@/components/agent/AgentToaster";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AgentInstallPrompt } from "@/components/agent/AgentInstallPrompt";
import { getAgentTheme, getMobileAgentTheme, getNightMode } from "@/lib/agent/themes";
import "./styles/themes.css";
import "./styles/agent-system.css";

// Roles permitted on the /agent/* surface.
// superadmin is excluded — they land on /command/overview.
const AGENT_ROLES = new Set(["director", "negotiator", "admin", "sales_progressor", "viewer"]);

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!AGENT_ROLES.has(session.user.role)) {
    redirect("/dashboard");
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hasSeenAgentWelcome: true, agentPreferences: true },
  });

  // Welcome modal is agent-onboarding-specific — suppress for internal staff.
  const isInternalStaff = session.user.role === "admin" || session.user.role === "sales_progressor" || session.user.role === "viewer";
  const showWelcome = isInternalStaff ? false : !userRecord?.hasSeenAgentWelcome;
  const theme = getAgentTheme(userRecord?.agentPreferences);
  const mobileTheme = getMobileAgentTheme(userRecord?.agentPreferences);
  const nightModePref = getNightMode(userRecord?.agentPreferences);

  return (
    <div data-theme={theme} style={{ display: "contents" }}>
      <AgentToaster>
        <AgentShell session={session} showWelcome={showWelcome} theme={theme} mobileTheme={mobileTheme} nightModePref={nightModePref}>{children}</AgentShell>
        {!isInternalStaff && <FeedbackWidget checklistAware userId={session.user.id} />}
        <AgentInstallPrompt />
      </AgentToaster>
    </div>
  );
}
