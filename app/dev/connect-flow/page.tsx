import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { isFounderEmail } from "@/lib/security/founder";
import { ConnectFlowPreview } from "./ConnectFlowPreview";

export const dynamic = "force-dynamic";

export default async function ConnectFlowDevPage() {
  const session = await requireSession();
  if (!isFounderEmail(session.user.email)) notFound();
  return <ConnectFlowPreview />;
}
