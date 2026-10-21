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
import { ComposeEmailButton } from "@/components/compose/ComposeEmailButton";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { agencyUserHasSelfManagedFiles } from "@/lib/agent/self-managed-nav";
import { listAutomatedEmails, getSendingToday, getSentTodayRows, type EmailListTab, type EmailDeliveryStatus } from "@/lib/services/automated-emails-list";
import { getAutomationOverview, getNeedsAttention } from "@/lib/services/automated-emails-overview";
import { getAutomationCoverage, getAutomationFiles } from "@/lib/services/automated-emails-coverage";
import { getChasePerformance, getEmailHealth } from "@/lib/services/automated-emails-analytics";
import { getUpcomingForecast } from "@/lib/services/automated-emails-upcoming";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { AutomatedEmailsListView } from "./AutomatedEmailsListView";
import { AutomationActivityPanel } from "@/components/automated-emails/AutomationActivityPanel";
import { NeedsAttentionPanel } from "@/components/automated-emails/NeedsAttentionPanel";
import { AutomationBanner } from "@/components/automated-emails/AutomationBanner";
import { AutomationCoveragePanel } from "@/components/automated-emails/AutomationCoveragePanel";
import { SendingTodayPanel } from "@/components/automated-emails/SendingTodayPanel";
import { AutoRefresh } from "@/components/automated-emails/AutoRefresh";
import { BloomStage } from "@/components/agent/BloomStage";

// Four sections (upgrade phase 2). Old tab values deep-linked from emails /
// bookmarks map onto their new home rather than 404ing or defaulting blindly.
const VALID_TABS = ["outbox", "history", "problems", "insights"] as const;
type PageTab = (typeof VALID_TABS)[number];
const LEGACY_TAB_MAP: Record<string, PageTab> = {
  pending: "outbox",
  upcoming: "outbox",
  sent: "history",
  errored: "problems",
  files: "insights",
  "chase-performance": "insights",
  "email-health": "insights",
};
const VALID_PERIODS = [7, 30, 90];

function subtitleFor(role: string, mineOnly: boolean, fileLabel: string | null, isHybridAdmin: boolean): string {
  if (fileLabel) return `Automated emails for ${fileLabel}.`;
  // Honest scope (truth pass 2026-10-21): the admin view is deliberately walled
  // to the files our team runs (resolveEmailScope), not "every agency".
  if (role === "admin" || role === "superadmin" || isHybridAdmin) return "Automated emails across the files our team runs.";
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

  const rawTab = sp.tab ?? "";
  const tab: PageTab = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as PageTab)
    : LEGACY_TAB_MAP[rawTab] ?? "outbox";
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
  // Section → underlying feed: Outbox lists the queue (predictions come from
  // the forecast), History lists sent, Problems lists problem emails. Insights
  // renders its own views, so the list only supplies counts there.
  const listTab: EmailListTab = tab === "history" ? "sent" : tab === "problems" ? "errored" : "pending";
  const [list, sentTodayRows, overview, needs, coverage, sendingToday, forecast, fileRows, chasePerformance, emailHealth] = await Promise.all([
    listAutomatedEmails({ ...scopeBase, tab: listTab, search, category, recipientRole, deliveryStatus, fromDate, limit, periodDays: period }),
    tab === "outbox" ? getSentTodayRows(scopeBase).catch(() => []) : Promise.resolve([]),
    getAutomationOverview({ ...scopeBase, periodDays: period }).catch(() => null),
    getNeedsAttention({ ...scopeBase, periodDays: period }).catch(() => null),
    getAutomationCoverage(scopeBase).catch(() => null),
    getSendingToday(scopeBase).catch(() => null),
    // Always fetched: the Outbox count and schedule both need the forecast.
    getUpcomingForecast(scopeBase).catch(() => null),
    tab === "insights" ? getAutomationFiles(scopeBase, search, period).catch(() => null) : Promise.resolve(null),
    tab === "insights" ? getChasePerformance({ ...scopeBase, periodDays: period }).catch(() => null) : Promise.resolve(null),
    tab === "insights" ? getEmailHealth({ ...scopeBase, periodDays: period }).catch(() => null) : Promise.resolve(null),
  ]);

  if (sp.fileId && !fileLabel) {
    // fileId in URL but no matching transaction OR not in scope — show empty
    // page rather than 404, with explanatory copy via the empty state.
    notFound();
  }

  // The Problems tab shows missing-email gaps as their own strip (they have no
  // email row to render). Mapped here so the client view stays presentational.
  const missingItems = (needs?.items ?? [])
    .filter((i) => i.status === "missing")
    .map((i) => ({ id: i.emailId, name: i.recipientName, role: i.recipientRole, transactionId: i.transactionId, address: i.transactionAddress }));

  // Standard agent-page chrome (founder feedback 2026-10-21): PageHeader owns
  // the header band full-width (compose button in its normal right-hand slot,
  // exactly where it sits on other pages) and the body uses the same content
  // pad as the hub/enquiries — no max-width cage, so the page stretches with
  // the window like every other agent page. AutoRefresh is invisible (silent
  // 2-minute re-pull).
  return (
    <div>
      <PageHeader
        title="Automated emails"
        subtitle={subtitleFor(role, mineOnly, fileLabel, hasAdminPowers(session))}
      >
        <ComposeEmailButton variant="ghost" />
      </PageHeader>
      <AutoRefresh />

      <div style={{ padding: "8px 32px 24px" }}>
      <BloomStage>
      {overview && (
        <div data-bloom>
        <AutomationBanner
          banner={overview.banner}
          needsTotal={needs?.total ?? 0}
          queuedNow={overview.metrics.queuedNow}
        />
        </div>
      )}

      {/* Row A — what needs a person, what's about to go out, how well set up we are */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {needs && <div data-bloom><NeedsAttentionPanel data={needs} /></div>}
        {sendingToday && <div data-bloom><SendingTodayPanel rows={sendingToday} sentToday={overview?.banner.sentToday ?? 0} /></div>}
        {coverage && <div data-bloom><AutomationCoveragePanel coverage={coverage} /></div>}
      </div>

      {/* The trend — full width so the chart has room */}
      {overview && (
        <div className="mb-4" data-bloom>
          <AutomationActivityPanel overview={overview} />
        </div>
      )}

      <div data-bloom>
      <AutomatedEmailsListView
        rows={list.rows}
        sentTodayRows={sentTodayRows}
        counts={list.counts}
        tab={tab}
        mineOnly={mineOnly}
        fileId={fileId}
        fileLabel={fileLabel}
        showMineToggle={role === "director"}
        hasMore={list.hasMore}
        needsTotal={needs?.total ?? 0}
        missingItems={missingItems}
        forecast={forecast}
        fileRows={fileRows}
        chasePerformance={chasePerformance}
        emailHealth={emailHealth}
      />
      </div>
      </BloomStage>
      </div>
    </div>
  );
}
