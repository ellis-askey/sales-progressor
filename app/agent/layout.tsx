import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AgentShell } from "@/components/layout/AgentShell";
import { AgentToaster } from "@/components/agent/AgentToaster";
import "./styles/agent-system.css";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.user.role !== "negotiator" && session.user.role !== "director") {
    redirect("/dashboard");
  }

  return (
    <AgentToaster>
      <AgentShell session={session}>{children}</AgentShell>
    </AgentToaster>
  );
}
