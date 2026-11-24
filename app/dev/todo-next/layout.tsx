import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { isFounder } from "./access";
import "@/app/styles/liquid-glass.css"; // read-only import of the shared --lg tokens (same as the library route)

// Server-side founder gate for the whole route subtree. 404 (not redirect) so the
// path is undiscoverable to anyone else. force-dynamic because the gate reads the
// session per request. This route is absent from all navigation — URL-only.
export const dynamic = "force-dynamic";

export default async function TodoNextLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!isFounder(session)) notFound();
  return <>{children}</>;
}
