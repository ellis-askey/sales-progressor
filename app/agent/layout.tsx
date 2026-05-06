import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AgentShell } from "@/components/layout/AgentShell";
import { AgentToaster } from "@/components/agent/AgentToaster";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AgentInstallPrompt } from "@/components/agent/AgentInstallPrompt";
import { getAgentTheme } from "@/lib/agent/themes";
import "./styles/themes.css";
import "./styles/agent-system.css";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.user.role !== "negotiator" && session.user.role !== "director") {
    redirect("/dashboard");
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hasSeenAgentWelcome: true, agentPreferences: true },
  });

  const showWelcome = !userRecord?.hasSeenAgentWelcome;
  const theme = getAgentTheme(userRecord?.agentPreferences);

  return (
    <div data-theme={theme} style={{ display: "contents" }}>
      <AgentToaster>
        <AgentShell session={session} showWelcome={showWelcome} theme={theme}>{children}</AgentShell>
        <FeedbackWidget checklistAware userId={session.user.id} />
        <AgentInstallPrompt />
      </AgentToaster>
    </div>
  );
}
