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
import { agencyUserHasSelfManagedFiles } from "@/lib/agent/self-managed-nav";
import { listAutomatedEmails, type EmailListTab, type EmailDeliveryStatus } from "@/lib/services/automated-emails-list";
import { getAutomationOverview, getNeedsAttention } from "@/lib/services/automated-emails-overview";
import { getUpcomingForecast } from "@/lib/services/automated-emails-upcoming";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { AutomatedEmailsListView } from "./AutomatedEmailsListView";
import { AutomationActivityPanel } from "@/components/automated-emails/AutomationActivityPanel";
import { NeedsAttentionPanel } from "@/components/automated-emails/NeedsAttentionPanel";

const VALID_TABS = ["pending", "sent", "errored", "upcoming"] as const;
const VALID_PERIODS = [7, 30, 90];

function subtitleFor(role: string, mineOnly: boolean, fileLabel: string | null, isHybridAdmin: boolean): string {
  if (fileLabel) return `Automated emails for ${fileLabel}.`;
  if (role === "admin" || role === "superadmin" || isHybridAdmin) return "All automated emails across every agency.";
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
  searchParams: Promise<{
    tab?: string; mine?: string; fileId?: string; period?: string;
    q?: string; category?: string; role?: string; status?: string; from?: string; limit?: string;
  }>;
}) {
  const session = await requireSession();
  // Founder rule 2026-08-09: an agency that outsources everything has no
  // Auto-emails page (the nav item is hidden too). Direct-URL access 404s.
  if (!(await agencyUserHasSelfManagedFiles(session.user.role, session.user.id, session.user.agencyId))) {
    notFound();
  }
  const sp = await searchParams;

  const tab: EmailListTab = (VALID_TABS as readonly string[]).includes(sp.tab ?? "")
    ? (sp.tab as EmailListTab)
    : "pending";
  const mineOnly = sp.mine === "1";
  const fileId = sp.fileId || undefined;
  const period = VALID_PERIODS.includes(Number(sp.period)) ? Number(sp.period) : 30;

  // Feed search + filters (validated; passed to the service which applies them
  // server-side, ANDed on top of scope so they can only narrow).
  const DELIVERY_STATUSES = ["pending", "sent", "delivered", "deferred", "bounced", "blocked", "errored", "failed"];
  const search = sp.q?.trim() || undefined;
  const category = sp.category === "chase" || sp.category === "notification" ? sp.category : undefined;
  const recipientRole = sp.role || undefined;
  const deliveryStatus = sp.status && DELIVERY_STATUSES.includes(sp.status) ? (sp.status as EmailDeliveryStatus) : undefined;
  const fromDate = sp.from && !Number.isNaN(Date.parse(sp.from)) ? new Date(sp.from) : undefined;
  const limit = Number(sp.limit) > 0 ? Number(sp.limit) : undefined;

  const role = session.user.role as
    | "director"
    | "negotiator"
    | "sales_progressor"
    | "admin"
    | "superadmin"
    | "viewer";

  // If a fileId was deep-linked, resolve the address up-front so the subtitle
  // can name it and the filter pill can show "Filtered to: <address>".
  // Scope the lookup: an out-of-scope fileId must NOT resolve an address, or
  // the subtitle leaks the property address of a file the viewer can't access
  // (a deep-linked cross-agency id would otherwise render "...for <address>").
  let fileLabel: string | null = null;
  if (fileId) {
    const tx = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(getAccessScope(session), fileId),
      select: { propertyAddress: true },
    });
    fileLabel = tx?.propertyAddress ?? null;
  }

  // Shared scope for every data module so counts, KPIs, issues and the feed
  // can never diverge on visibility.
  const scopeBase = {
    role,
    userId: session.user.id,
    agencyId: session.user.agencyId || null,
    hasAdminPowers: hasAdminPowers(session),
    mineOnly: role === "director" ? mineOnly : false,
    fileId,
  };

  // Each module degrades independently — a failure in the overview or the
  // issues panel must not blank the whole page.
  // On the Upcoming tab the feed comes from the richer forecast (client +
  // solicitor predictions + exhausted), so the list only needs its counts —
  // fetch cheap pending rows to avoid a second per-file prediction fan-out.
  const listTab = tab === "upcoming" ? "pending" : tab;
  const [list, overview, needs, forecast] = await Promise.all([
    listAutomatedEmails({ ...scopeBase, tab: listTab, search, category, recipientRole, deliveryStatus, fromDate, limit }),
    getAutomationOverview({ ...scopeBase, periodDays: period }).catch(() => null),
    getNeedsAttention({ ...scopeBase, periodDays: period }).catch(() => null),
    tab === "upcoming" ? getUpcomingForecast(scopeBase).catch(() => null) : Promise.resolve(null),
  ]);

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          {overview && <AutomationActivityPanel overview={overview} />}
        </div>
        <div className="lg:col-span-1">
          {needs && <NeedsAttentionPanel data={needs} />}
        </div>
      </div>

      <AutomatedEmailsListView
        rows={list.rows}
        counts={list.counts}
        tab={tab}
        mineOnly={mineOnly}
        fileId={fileId}
        fileLabel={fileLabel}
        showMineToggle={role === "director"}
        hasMore={list.hasMore}
        forecast={forecast}
      />
    </div>
  );
}
