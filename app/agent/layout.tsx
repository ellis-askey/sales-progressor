import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AgentShell } from "@/components/layout/AgentShell";
import { AgentToaster } from "@/components/agent/AgentToaster";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AgentInstallPrompt, AgentPushPrompt } from "@/components/agent/AgentInstallPrompt";
import "./styles/agent-system.css";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.user.role !== "negotiator" && session.user.role !== "director") {
    redirect("/dashboard");
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hasSeenAgentWelcome: true },
  });

  const showWelcome = !userRecord?.hasSeenAgentWelcome;

  return (
    <AgentToaster>
      <AgentShell session={session} showWelcome={showWelcome}>{children}</AgentShell>
      <FeedbackWidget checklistAware />
      <AgentInstallPrompt />
      <AgentPushPrompt />
    </AgentToaster>
  );
}
