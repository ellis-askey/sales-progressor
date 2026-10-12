import { getFormsSession } from "@/lib/forms/auth";
import { redirect } from "next/navigation";
import { AccountPanel } from "@/components/boardwalk/AccountPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Account" };

export default async function BoardwalkAccountPage() {
  const session = await getFormsSession();
  if (!session) redirect("/boardwalk/login");
  return <AccountPanel session={session} />;
}
