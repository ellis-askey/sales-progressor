import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Outer command layout — gates on superadmin role only.
 *  TOTP enrollment and step-up cookie checks live in (protected)/layout.tsx
 *  so that /setup-2fa and /auth/step-up are exempt from those checks. */
export default async function CommandOuterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
