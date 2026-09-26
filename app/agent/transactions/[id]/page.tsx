// Agent file-detail — Overview tab (the file's index route).
//
// 2026-09-20 perf overhaul (Layer 1): the shell (hero, milestone strip, sidebar,
// tab bar, banners) now lives in layout.tsx and each tab is its own route
// segment. This file is just the Overview tab body. Opening a file renders the
// shell + this — nothing else fetches until another tab is clicked.

import { redirect } from "next/navigation";
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { OverviewPanel } from "@/components/transaction/OverviewPanel";
import { EnquiryTrackerSection } from "@/components/transaction/EnquiryTrackerSection";
import { ClientMortgageExpiryCard } from "@/components/transaction/ClientMortgageExpiryCard";
import { TabEnter } from "@/components/transaction/TabEnter";

export const unstable_dynamicStaleTime = 300;

// Legacy deep-links used ?tab=<key>. Tabs are now route segments, so bounce
// those to the segment; ?tab=overview (or none) stays here.
const TAB_SEGMENTS = new Set([
  "setup", "milestones", "chain", "reminders", "chase", "todos", "documents", "activity", "whatsapp",
]);

export default async function AgentTransactionOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  if (tab && TAB_SEGMENTS.has(tab)) {
    redirect(`/agent/transactions/${id}/${tab}`);
  }

  const ctx = await loadFilePageContext(id);
  const { session, transaction, isInternalStaff, isDirectorRole, isEllis } = ctx;

  return (
    <TabEnter>
      <OverviewPanel
        transaction={transaction}
        agencyId={session.user.agencyId}
        isInternalStaff={isInternalStaff}
        isDirectorRole={isDirectorRole}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
        currentUserName={session.user.name ?? ""}
        recommendedFirms={null}
        isEllis={isEllis}
      />
      <div className="mt-5">
        <EnquiryTrackerSection transactionId={transaction.id} />
      </div>
      <div className="mt-5">
        <ClientMortgageExpiryCard transactionId={transaction.id} />
      </div>
    </TabEnter>
  );
}
