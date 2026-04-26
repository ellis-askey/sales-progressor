import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function RootPage() {
  const session = await getSession();
  if (session?.user) {
    // Role-aware dispatch — each role lands in the right product area
    switch (session.user.role) {
      case "negotiator":
      case "director":
        redirect("/agent/hub-preview");
      case "admin":
      case "sales_progressor":
      case "viewer":
      default:
        redirect("/dashboard");
    }
  }
  redirect("/login");
}
