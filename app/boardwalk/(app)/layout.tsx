// Auth-gated Boardwalk area. Everything under (app) requires a Boardwalk
// Forms session. A provisioned-but-unchanged temporary password forces the
// user to /boardwalk/welcome (which lives OUTSIDE this route group, so there
// is no redirect loop) until they've chosen their own password.

import { redirect } from "next/navigation";
import { getFormsSession } from "@/lib/forms/auth";
import { BoardwalkShell } from "@/components/boardwalk/BoardwalkShell";

export const dynamic = "force-dynamic";

export default async function BoardwalkAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getFormsSession();
  if (!session) redirect("/boardwalk/login");
  if (session.mustChangePassword) redirect("/boardwalk/welcome");

  return <BoardwalkShell session={session}>{children}</BoardwalkShell>;
}
