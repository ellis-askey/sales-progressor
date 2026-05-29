import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";

export const dynamic = "force-dynamic";

/** Outer command layout — gates on superadmin (real or hybrid).
 *  TOTP enrollment and step-up cookie checks live in (protected)/layout.tsx
 *  so that /setup-2fa and /auth/step-up are exempt from those checks. */
export default async function CommandOuterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
