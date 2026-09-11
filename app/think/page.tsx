import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { ThinkCapture } from "@/components/command/content/ThinkCapture";

// Bookmarkable quick-capture (docs/active/content-brand/SPEC.md). A tiny page to
// bookmark or add to the phone home screen: type a thought, save, keep going.
// Ellis only; feeds "Things you think".

export const dynamic = "force-dynamic";

export default async function ThinkPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/think");
  if (!hasSuperAdminPowers(session)) redirect("/agent/hub");

  return <ThinkCapture />;
}
