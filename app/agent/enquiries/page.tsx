import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { getOpenEnquiries } from "@/lib/services/enquiries";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EnquiriesTriageList } from "@/components/enquiries/EnquiriesTriageList";
import { EnquiriesEmptyState } from "@/components/enquiries/EnquiriesEmptyState";

// Enquiries triage. Internal staff plus customer agency staff (director /
// negotiator) who progress their own files. The read is agency-scoped via
// getAccessScope, so an agency user only ever sees their own agency's open
// loops (and an all-outsourced agency simply sees an empty list). The nav item
// mirrors this with the self-managed gate. See docs/active/enquiries-triage/00-spec.md.
export default async function EnquiriesPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (!(role === "admin" || role === "sales_progressor" || role === "superadmin" || role === "director" || role === "negotiator")) {
    notFound();
  }

  const scope = getAccessScope(session);
  const rows = await getOpenEnquiries(scope);
  // No open loops → the "all clear" empty state. Only reachable once the agency
  // has a live file (nav gates on hasSelfManagedFiles), so it reads as a resting
  // state, not a brand-new-account one. Skip the photo signing when there's
  // nothing to show.
  const signed = rows.length
    ? await getSignedUrlMap(
        rows.map((r) => r.photoStoragePath).filter((p): p is string => !!p),
      ).catch(() => new Map<string, string>())
    : new Map<string, string>();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PageHeader title="Enquiries" subtitle="See what's outstanding, who has it and what needs chasing." />
      <div className="hub-content-pad" style={{ padding: "8px 32px 24px" }}>
        {rows.length === 0 ? (
          <EnquiriesEmptyState />
        ) : (
          <EnquiriesTriageList rows={rows} signedPhotos={Object.fromEntries(signed)} />
        )}
      </div>
    </div>
  );
}
