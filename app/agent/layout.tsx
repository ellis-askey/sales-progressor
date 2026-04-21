import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AgentShell } from "@/components/layout/AgentShell";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.user.role !== "negotiator" && session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return <AgentShell session={session}>{children}</AgentShell>;
}
