import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { CompleteSignupForm } from "./CompleteSignupForm";

export default async function CompleteSignupPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.needsSignupCompletion) {
    // Already complete — send to root which handles role-based routing
    redirect("/");
  }

  return (
    <CompleteSignupForm
      defaultName={session.user.name ?? ""}
      email={session.user.email}
    />
  );
}
