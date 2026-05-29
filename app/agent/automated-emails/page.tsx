// Platform-wide automated emails feed.
//
// Visible to all roles. Scoped per role:
//   - admin / superadmin → all transactions platform-wide
//   - sales_progressor   → their assigned outsourced files
//   - negotiator         → files where they're the agentUser
//   - director           → all agency files by default; segment-pill toggle
//                          narrows to their own files
//
// Tabs: pending / sent (30d) / errored / upcoming (14d forecast).
// URL state: ?tab=...&mine=1&fileId=... — deep-linkable.

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { listAutomatedEmails, type EmailListTab } from "@/lib/services/automated-emails-list";
import { prisma } from "@/lib/prisma";
import { AutomatedEmailsListView } from "./AutomatedEmailsListView";

const VALID_TABS = ["pending", "sent", "errored", "upcoming"] as const;

function subtitleFor(role: string, mineOnly: boolean, fileLabel: string | null, isHybridAdmin: boolean): string {
  if (fileLabel) return `Automated emails for ${fileLabel}.`;
  if (role === "admin" || role === "superadmin" || isHybridAdmin) return "All automated emails across the platform.";
  if (role === "sales_progressor") return "Automated emails for files assigned to you.";
  if (role === "negotiator") return "Automated emails for files assigned to you.";
  if (role === "director") {
    return mineOnly
      ? "Automated emails for files assigned to you."
      : "All automated emails for your agency's files.";
  }
  return "Automated emails.";
}

export default async function AutomatedEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; mine?: string; fileId?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const tab: EmailListTab = (VALID_TABS as readonly string[]).includes(sp.tab ?? "")
    ? (sp.tab as EmailListTab)
    : "pending";
  const mineOnly = sp.mine === "1";
  const fileId = sp.fileId || undefined;

  const role = session.user.role as
    | "director"
    | "negotiator"
    | "sales_progressor"
    | "admin"
    | "superadmin"
    | "viewer";

  // If a fileId was deep-linked, resolve the address up-front so the subtitle
  // can name it and the filter pill can show "Filtered to: <address>".
  let fileLabel: string | null = null;
  if (fileId) {
    const tx = await prisma.propertyTransaction.findUnique({
      where: { id: fileId },
      select: { propertyAddress: true },
    });
    fileLabel = tx?.propertyAddress ?? null;
  }

  const { rows, counts } = await listAutomatedEmails({
    role,
    userId: session.user.id,
    agencyId: session.user.agencyId || null,
    hasAdminPowers: hasAdminPowers(session),
    mineOnly: role === "director" ? mineOnly : false,
    fileId,
    tab,
  });

  if (sp.fileId && !fileLabel) {
    // fileId in URL but no matching transaction OR not in scope — show empty
    // page rather than 404, with explanatory copy via the empty state.
    notFound();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Automated emails"
        subtitle={subtitleFor(role, mineOnly, fileLabel, hasAdminPowers(session))}
      />
      <AutomatedEmailsListView
        rows={rows}
        counts={counts}
        tab={tab}
        mineOnly={mineOnly}
        fileId={fileId}
        fileLabel={fileLabel}
        showMineToggle={role === "director"}
      />
    </div>
  );
}
