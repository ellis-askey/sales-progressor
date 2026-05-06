import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function RootPage() {
  const session = await getSession();
  if (session?.user) {
    // OAuth user who hasn't finished the signup form yet
    if (session.user.needsSignupCompletion) {
      redirect("/signup/complete");
    }
    // Role-aware dispatch — each role lands in the right product area
    switch (session.user.role) {
      case "superadmin":
        redirect("/command/overview");
      case "negotiator":
      case "director":
        redirect("/agent/hub");
      case "admin":
      case "sales_progressor":
      case "viewer":
      default:
        redirect("/dashboard");
    }
  }
  redirect("/login");
}
