// First-login page for provisioned accounts: forces a password change before
// the rest of the app is reachable. Lives outside the (app) route group so the
// mustChangePassword redirect in that layout can't loop.

import { redirect } from "next/navigation";
import { getFormsSession } from "@/lib/forms/auth";
import { WelcomePasswordCard } from "@/components/boardwalk/WelcomePasswordCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Welcome" };

export default async function BoardwalkWelcomePage() {
  const session = await getFormsSession();
  if (!session) redirect("/boardwalk/login");
  if (!session.mustChangePassword) redirect("/boardwalk/forms");
  return <WelcomePasswordCard name={session.name} />;
}
