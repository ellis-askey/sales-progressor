// Ellis-only overlay + button gallery. Reachable in production, but ONLY for
// ellis@thesalesprogressor.co.uk — everyone else (including logged-out) gets a
// 404. /dev is excluded from the middleware auth gate, so we read the session
// here and 404 unless it's Ellis.

import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { OverlaysGallery } from "@/components/dev/OverlaysGallery";

const ALLOWED_EMAIL = "ellis@thesalesprogressor.co.uk";

export const dynamic = "force-dynamic";

export default async function OverlaysDevPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email !== ALLOWED_EMAIL) notFound();
  return <OverlaysGallery />;
}
