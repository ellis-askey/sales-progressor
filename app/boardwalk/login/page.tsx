import { redirect } from "next/navigation";
import { getFormsSession } from "@/lib/forms/auth";
import { LoginCard } from "@/components/boardwalk/LoginCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in" };

export default async function BoardwalkLoginPage() {
  const session = await getFormsSession();
  if (session) redirect("/boardwalk/forms");
  return <LoginCard />;
}
