import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { getOpenEnquiries } from "@/lib/services/enquiries";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EnquiriesTriageList } from "@/components/enquiries/EnquiriesTriageList";

// Enquiries triage. Internal only for now (widens to agents later, same gate).
// See docs/active/enquiries-triage/00-spec.md.
export default async function EnquiriesPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (!(role === "admin" || role === "sales_progressor" || role === "superadmin")) {
    notFound();
  }

  const scope = getAccessScope(session);
  const rows = await getOpenEnquiries(scope);
  const signed = await getSignedUrlMap(
    rows.map((r) => r.photoStoragePath).filter((p): p is string => !!p),
  ).catch(() => new Map<string, string>());

  const subtitle =
    rows.length === 0
      ? "No open enquiry loops right now."
      : rows.length === 1
        ? "One open enquiry loop. Confirm whose court it's in."
        : `${rows.length} open enquiry loops. Confirm whose court each is in.`;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PageHeader title="Enquiries" subtitle={subtitle} />
      <div className="hub-content-pad" style={{ padding: "8px 32px 24px" }}>
        <EnquiriesTriageList rows={rows} signedPhotos={Object.fromEntries(signed)} />
      </div>
    </div>
  );
}
