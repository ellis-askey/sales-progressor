// Founder-only "what to work on next" cockpit (critiques #12 + #29).
// Gated to the founder's account; anyone else 404s. Always fresh — the ordering
// is by last human contact, so it must not be cached.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getNextFiles } from "@/lib/services/next-files";
import { FilesCockpit } from "@/components/next/FilesCockpit";

export const metadata = { title: "Focus" };
export const dynamic = "force-dynamic";

const FOUNDER_EMAIL = "ellis@thesalesprogressor.co.uk";

export default async function FocusPage() {
  const session = await requireSession();
  if (session.user.email !== FOUNDER_EMAIL) notFound();

  const data = await getNextFiles(session);
  return <FilesCockpit initialFiles={data.files} />;
}
