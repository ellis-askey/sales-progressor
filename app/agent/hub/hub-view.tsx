// The agent hub. (Formerly "legacy-hub" from an abandoned "kinetic" redesign
// that was reverted twice for regressions and removed 2026-08-27 — this is now
// the one and only hub.) Metadata lives on the route page.tsx.
//
// 2026-08-10: rewritten from a single-Promise.all monolith into per-section
// async server components wrapped in Suspense. Shell (header + payment
// banners + empty-state gate) renders instantly from session data. Each
// downstream section fetches its OWN data and streams in independently
// with a SectionReveal fade-up + a per-section `order` prop so cascades
// stay visible on fast networks. Loading fallbacks use real card
// containers with a small "Loading X…" line — no grey skeleton blocks.
// See components/hub/SectionReveal.tsx + components/hub/SectionLoading.tsx.

import type React from "react";
import { Suspense } from "react";
import { extractFirstName } from "@/lib/contacts/displayName";

import { requireSession } from "@/lib/session";
import type { Session } from "next-auth";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import type { AgentVisibility } from "@/lib/services/agent";
import {
  getHubPipelineStats, getHubAttentionItems, getHubWins,
  getHubWeeklyForecast, getHubServiceSplit, getHubRecentActivity, getHubDiary,
  getHubUnassignedFiles, getExpiredHolds, getHubRelistsToAcknowledge, getHubChainSetupPending,
  getHubPipelineStages, getUpcomingMortgageExpiries, getGoneQuietFiles,
  getHubSubtitleSignals,
} from "@/lib/services/hub";
import type { DiaryItem, HubSubtitleSignals } from "@/lib/services/hub";
import { DiaryEventRow } from "@/components/hub/DiaryEventRow";
import { AgentFlagButton } from "@/components/agent/AgentFlagButton";
import { EmailSetupPrompt } from "@/components/agent/EmailSetupPrompt";
import { HubEmptyState } from "@/components/agent/HubEmptyState";
import { agencyHasActiveOutsourcedFile } from "@/lib/agent/outsourcing";
import {
  ExchangeForecastChart, ServiceSplitDonut,
} from "@/components/hub/HubCharts";
import { WinsCard } from "@/components/hub/WinsCard";
import { PipelineAtAGlance } from "@/components/hub/PipelineAtAGlance";
import { AttentionCard } from "@/components/hub/AttentionCard";
import { HubListCard, type HubRowData, type HubRowTone } from "@/components/hub/HubListCard";
import { AnimatedSection } from "@/components/hub/AnimatedSection";
import { SectionReveal } from "@/components/hub/SectionReveal";
import { SectionLoading } from "@/components/hub/SectionLoading";
import { LoadingCard } from "@/components/loading/LoadingCard";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { GlassCard } from "@/components/glass/GlassCard";
import { PaymentBlockBanner } from "@/components/billing/PaymentBlockBanner";
import { PaymentMethodNudge } from "@/components/billing/PaymentMethodNudge";
import Link from "next/link";
import { Plus, Clock, ArrowRight, Warning, CaretRight, HouseSimple, CheckCircle, Envelope, ChatCircleText, Phone, ChatText, Lightbulb } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(name: string): string {
  try {
    const hourStr = new Date().toLocaleString("en-GB", {
      timeZone: "Europe/London", hour: "numeric", hour12: false,
    });
    const hour = parseInt(hourStr, 10);
    const prefix = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return `${prefix}, ${extractFirstName(name)} 👋`;
  } catch {
    return `Hello, ${extractFirstName(name)}`;
  }
}

// Journey-aware subtitle for agency users: onboarding stage sets the baseline;
// today's signals (a completion / exchange due, files needing attention) take
// priority once they have sales. Priority is top-to-bottom, first match wins.
// The generic line is the safe fallback (used on a signals-load error). Strings
// approved by Ellis 2026-08-30.
function buildAgencySubtitle(s: HubSubtitleSignals): string {
  // No real sales yet.
  if (s.realSales === 0) {
    return s.hasDemo
      ? "You’re exploring the demo. Ready to add your own?"
      : "Your pipeline starts with your first sale.";
  }
  // Today's signals (they have at least one real sale).
  if (s.completionsToday > 0) {
    return s.completionsToday === 1
      ? "One of your sales completes today."
      : `${s.completionsToday} of your sales complete today.`;
  }
  if (s.exchangesToday > 0) {
    return s.exchangesToday === 1
      ? "One of your sales is set to exchange today."
      : `${s.exchangesToday} of your sales are set to exchange today.`;
  }
  if (s.exchangingThisWeek > 0) {
    return s.exchangingThisWeek === 1
      ? "One sale is on track to exchange this week."
      : `${s.exchangingThisWeek} sales are on track to exchange this week.`;
  }
  if (s.attentionCount === 1) return "One sale needs your attention today.";
  if (s.attentionCount > 1)  return `${s.attentionCount} sales need your attention today.`;
  // Nothing urgent — baseline by pipeline size.
  if (s.realSales === 1) return "Your first sale is up and running.";
  if (s.realSales <= 4)  return "Your pipeline is taking shape.";
  return "Everything’s on track. Nothing needs your attention today.";
}

async function getSubtitle(
  vis: AgentVisibility,
  isAdmin: boolean,
  isProgressor: boolean,
): Promise<string> {
  if (isAdmin) return "Here's what's happening across the platform today.";
  if (isProgressor) return "Here's what's happening with your assigned files today.";
  try {
    return buildAgencySubtitle(await getHubSubtitleSignals(vis));
  } catch {
    // Safe fallback (the previous static agency line) if signals fail to load.
    return "Here's what's happening across your pipeline today.";
  }
}

function fmtCurrency(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000_000) return `£${(p / 1_000_000_000).toFixed(2)}bn`;
  if (p >= 1_000_000)     return `£${(p / 1_000_000).toFixed(2)}m`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}

function fmtCompact(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (p >= 1_000)     return `£${Math.round(p / 1_000)}k`;
  return `£${Math.round(p)}`;
}

function pickActivityGlyph(kind: "comm" | "milestone", description: string): {
  Icon: typeof CheckCircle;
  bg: string;
  color: string;
} {
  if (kind === "milestone") {
    return { Icon: CheckCircle, bg: "var(--agent-success-bg)", color: "var(--agent-success)" };
  }
  const d = description.toLowerCase();
  if (d.includes("whatsapp")) {
    return { Icon: ChatCircleText, bg: "rgba(37, 211, 102, 0.10)", color: "#128c7e" };
  }
  if (d.includes("call")) {
    return { Icon: Phone, bg: "rgba(59, 130, 246, 0.10)", color: "#1d4ed8" };
  }
  if (d.includes("sms")) {
    return { Icon: ChatText, bg: "rgba(139, 92, 246, 0.10)", color: "#6d28d9" };
  }
  return { Icon: Envelope, bg: "var(--agent-coral-bg-tint)", color: "var(--agent-coral-deep)" };
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60)  return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs  = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// Shared context passed to inner slots — cheap to compute in the shell.
type Ctx = {
  session: Session;
  vis: AgentVisibility;
  role: string;
  isInternalStaff: boolean;
  isProgressor: boolean;
  isAdmin: boolean;
  canCreateSale: boolean;
};

// ── Inline loading card — v05 glass container with a small "Loading X…" line.
// Kept text-based (not LoadingDots) because the label gives the user useful
// context on which section is slow. Used for section-level Suspense
// fallbacks; the top-level BodyGate fallback uses <LoadingCard> (dots).
function InlineLoadingCard({
  label,
  minHeight,
}: {
  label: string;
  minHeight: number;
}) {
  return (
    <div
      className="glass-v05"
      style={{
        borderRadius: "var(--agent-radius-xl)",
        padding: "20px 24px",
        minHeight,
        display: "flex",
        alignItems: "center",
      }}
    >
      <SectionLoading label={label} bare />
    </div>
  );
}

// ── Page — shell renders instantly, body gated behind pipelineStats+attention ─

export default async function Hub() {
  const session = await requireSession();
  const role              = session.user.role;
  const isInternalStaff   = role === "admin" || role === "sales_progressor" || role === "viewer";
  const hasOutsourced     = await agencyHasActiveOutsourcedFile(session.user.agencyId);
  const isProgressor      = role === "sales_progressor";
  const isAdmin           = hasAdminPowers(session);
  const canCreateSale     = role === "director" || role === "negotiator" || role === "admin";

  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, role, isAdmin)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const greeting = getGreeting(session.user.name ?? "there");
  const subtitle = await getSubtitle(vis, isAdmin, isProgressor);

  const ctx: Ctx = { session, vis, role, isInternalStaff, isProgressor, isAdmin, canCreateSale };

  return (
    <div data-testid="hub-full-state" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      <PageHeader title={greeting} subtitle={subtitle}>
        {canCreateSale && (
          <Link href="/agent/transactions/new" className="agent-btn agent-btn-primary agent-btn-sm" style={{ textDecoration: "none" }}>
            <Plus size={14} weight="bold" />
            New sale
          </Link>
        )}
        {!isInternalStaff && hasOutsourced && (
          <AgentFlagButton transactionId={null} address="general" label="Send a note to our team" />
        )}
      </PageHeader>

      <div className="hub-content-pad" style={{ padding: "8px 32px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Payments (self-contained; own async internally) */}
        {role === "director" && session.user.agencyId && (
          <PaymentBlockBanner agencyId={session.user.agencyId} />
        )}
        {role === "director" && session.user.agencyId && (
          <PaymentMethodNudge agencyId={session.user.agencyId} />
        )}

        {/* Body gate — decides empty vs full. NO outer SectionReveal wrap here:
            wrapping the body would fade everything as one block and swallow
            the per-section cascade. Each slot below owns its own SectionReveal
            with an `order` prop so they cascade top-to-bottom. */}
        <Suspense fallback={<LoadingCard label="Loading your hub" minHeight={140} />}>
          <BodyGate ctx={ctx} />
        </Suspense>

        {/* Nudge directors still on the shared fallback to set up their own email.
            Sits below the body (hero + what-happens-next in the empty state) so
            it reads as a follow-on, not a header banner. */}
        {role === "director" && session.user.agencyId && (
          <EmailSetupPrompt userId={session.user.id} />
        )}
      </div>
    </div>
  );
}

// ── BodyGate — pipeline zero + attention zero → welcome empty state ─────────

async function BodyGate({ ctx }: { ctx: Ctx }) {
  const [pipelineStats, attentionItems] = await Promise.all([
    getHubPipelineStats(ctx.vis),
    getHubAttentionItems(ctx.vis),
  ]);
  const isEmpty = pipelineStats.activeFiles === 0 && attentionItems.length === 0;
  if (isEmpty) return <EmptyStateBody ctx={ctx} />;
  return (
    <FullHubBody ctx={ctx} initialPipelineStats={pipelineStats} initialAttentionItems={attentionItems} />
  );
}

// ── Empty state — verbatim from previous implementation, no fade ────────────

function EmptyStateBody({ ctx }: { ctx: Ctx }) {
  const { isProgressor, canCreateSale } = ctx;

  // Agency users (director / negotiator / admin) get the onboarding empty state.
  if (!isProgressor) {
    return (
      <div data-testid="hub-empty-state">
        <HubEmptyState userId={ctx.session.user.id} canCreateSale={canCreateSale} />
      </div>
    );
  }

  // Progressor: no assigned files, plus the decorative ghost preview below.
  return (
    <div data-testid="hub-empty-state" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="agent-glass" style={{ padding: "26px 30px", borderRadius: "var(--agent-radius-xl)" }}>
          <p style={{ margin: "0 0 4px", fontSize: "var(--agent-text-h3)", fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
            No assigned files yet.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
            Files assigned to you will appear here.
          </p>
        </div>

      {/* Ghost pipeline health + momentum (decorative — kept as-is) */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, opacity: 0.35, pointerEvents: "none" }}>
        <div className="agent-glass" style={{ padding: "20px 24px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 20 }}>Pipeline health</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
            {["Active files", "Exchanging soon", "Need attention", "Pipeline value"].map((label, i) => (
              <div key={i} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "6px 12px", gap: 6,
                borderLeft: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined,
              }}>
                <div className="agent-skeleton" style={{ width: 36, height: 22, borderRadius: 4 }} />
                <span style={{ fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="agent-glass" style={{ padding: "20px 24px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 16 }}>Wins this month</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
            <div className="agent-skeleton" style={{ width: 60, height: 30, borderRadius: 6 }} />
            <div className="agent-skeleton" style={{ width: 120, height: 12, borderRadius: 4 }} />
            <div className="agent-skeleton" style={{ width: 90, height: 10, borderRadius: 4 }} />
          </div>
        </div>
      </div>

      {/* Ghost attention */}
      <div
        className="agent-glass-strong"
        style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden", opacity: 0.35, pointerEvents: "none" }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Clock size={15} color="var(--agent-text-muted)" />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>
              Needs your attention
            </p>
          </div>
        </div>
        {[0.55, 0.38, 0.47].map((w, i) => (
          <div key={i} style={{
            padding: "13px 20px 13px 17px",
            borderLeft: "3px solid var(--agent-border-subtle)",
            borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div className="agent-skeleton" style={{ height: 12, borderRadius: 4, width: `${w * 100}%`, marginBottom: 6 }} />
              <div className="agent-skeleton" style={{ height: 11, borderRadius: 4, width: `${w * 60}%` }} />
            </div>
            <div className="agent-skeleton" style={{ height: 18, width: 58, borderRadius: 99, flexShrink: 0 }} />
          </div>
        ))}
      </div>

      {/* Ghost exchange forecast + service split */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, opacity: 0.35, pointerEvents: "none" }}>
        <div className="agent-glass" style={{ padding: "20px 24px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 16 }}>Exchange forecast</p>
          <div style={{ display: "flex", gap: 3, alignItems: "flex-end", marginBottom: 10 }}>
            {[40, 68, 28, 82, 52].map((h, i) => (
              <div key={i} className="agent-skeleton" style={{ flex: 1, height: h, borderRadius: 3 }} />
            ))}
          </div>
          <div className="agent-skeleton" style={{ height: 11, borderRadius: 4, width: "65%", marginBottom: 5 }} />
          <div className="agent-skeleton" style={{ height: 11, borderRadius: 4, width: "45%" }} />
        </div>
        <div className="agent-glass" style={{ padding: "20px 24px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 16 }}>Who&apos;s managing</p>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 4 }}>
            <div className="agent-skeleton" style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="agent-skeleton" style={{ height: 12, borderRadius: 4 }} />
              <div className="agent-skeleton" style={{ height: 12, borderRadius: 4, width: "75%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Full hub body — layout container with each section in its own Suspense ──

function FullHubBody({
  ctx, initialPipelineStats, initialAttentionItems,
}: {
  ctx: Ctx;
  initialPipelineStats: Awaited<ReturnType<typeof getHubPipelineStats>>;
  initialAttentionItems: Awaited<ReturnType<typeof getHubAttentionItems>>;
}) {
  return (
    <>
      {/* Today's diary — hidden when empty */}
      <Suspense fallback={null}>
        <DiarySlot vis={ctx.vis} />
      </Suspense>

      {/* Unified attention card */}
      <Suspense fallback={<InlineLoadingCard label="Looking for anything needing attention…" minHeight={140} />}>
        <AttentionSlot vis={ctx.vis} initialAttentionItems={initialAttentionItems} />
      </Suspense>

      {/* Gone quiet + mortgage expiries — deduped against Needs-attention AND
          each other so a property never stacks across cards. Hidden when none. */}
      <Suspense fallback={null}>
        <LowerHubCards vis={ctx.vis} attentionTxIds={initialAttentionItems.map((i) => i.transaction.id)} />
      </Suspense>

      {/* Pipeline at a glance — 5 stage tiles */}
      <Suspense fallback={<InlineLoadingCard label="Loading pipeline stages…" minHeight={100} />}>
        <PipelineStagesSlot vis={ctx.vis} />
      </Suspense>

      {/* Pipeline health + Wins grid */}
      <div className="hub-grid-main" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Suspense fallback={<InlineLoadingCard label="Loading pipeline health…" minHeight={260} />}>
          <PipelineHealthCard ctx={ctx} initialPipelineStats={initialPipelineStats} initialAttentionItems={initialAttentionItems} />
        </Suspense>
        <Suspense fallback={<InlineLoadingCard label="Loading recent wins…" minHeight={260} />}>
          <WinsCardSlot vis={ctx.vis} />
        </Suspense>
      </div>

      {/* Exchange forecast + Service split grid */}
      <div className="hub-grid-half" style={{ display: "grid", gridTemplateColumns: (ctx.isProgressor && !ctx.isAdmin) ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Suspense fallback={<InlineLoadingCard label="Loading exchange forecast…" minHeight={220} />}>
          <ExchangeForecastCard ctx={ctx} />
        </Suspense>
        {(!ctx.isProgressor || ctx.isAdmin) && (
          <Suspense fallback={<InlineLoadingCard label="Loading service split…" minHeight={220} />}>
            <ServiceSplitCard ctx={ctx} />
          </Suspense>
        )}
      </div>

      {/* Recent activity ribbon */}
      <Suspense fallback={null}>
        <ActivityRibbonSlot vis={ctx.vis} />
      </Suspense>

      {/* Pro tip banner */}
      <Suspense fallback={null}>
        <ProTipSlot ctx={ctx} />
      </Suspense>
    </>
  );
}

// ── Per-section async slots ─────────────────────────────────────────────────
// Each SectionReveal gets an `order` prop for the top-to-bottom 40ms cascade
// when multiple sections resolve within the same frame.

async function DiarySlot({ vis }: { vis: AgentVisibility }) {
  const diaryItems = await getHubDiary(vis);
  if (diaryItems.length === 0) return null;
  return (
    <SectionReveal order={0}>
      <GlassCard glassId="hub-diary" label="Hub · Today's diary" defaultVariant="v05" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
        <div className="agent-card-hdr" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p className="agent-card-title-emphasis">Today&apos;s diary</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
              Exchanges and completions scheduled for today
            </p>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
            color: "var(--agent-success)", background: "var(--agent-success-bg)",
            border: "1px solid var(--agent-success-border)",
            padding: "3px 10px", borderRadius: 99,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            {diaryItems.length} {diaryItems.length === 1 ? "event" : "events"} today
          </span>
        </div>
        {diaryItems.map((item: DiaryItem, i: number) => (
          <DiaryEventRow key={item.transactionId} item={item} isFirst={i === 0} />
        ))}
      </GlassCard>
    </SectionReveal>
  );
}

async function AttentionSlot({
  vis, initialAttentionItems,
}: {
  vis: AgentVisibility;
  initialAttentionItems: Awaited<ReturnType<typeof getHubAttentionItems>>;
}) {
  const [expiredHolds, unassignedFiles, relistsToAcknowledge, chainSetupPending] = await Promise.all([
    getExpiredHolds(vis),
    getHubUnassignedFiles(vis),
    getHubRelistsToAcknowledge(vis),
    getHubChainSetupPending(vis),
  ]);
  const photoUrlMap = await getSignedUrlMap([
    ...expiredHolds.map((h) => h.photoStoragePath),
    ...initialAttentionItems.map((i) => i.transaction.photoStoragePath),
    ...unassignedFiles.map((f) => f.photoStoragePath),
    ...relistsToAcknowledge.map((r) => r.photoStoragePath),
    ...chainSetupPending.map((f) => f.photoStoragePath),
  ]);
  const signed = (path: string | null) => (path ? photoUrlMap.get(path) ?? null : null);

  return (
    <SectionReveal order={1}>
      <AnimatedSection>
        <AttentionCard
          holds={expiredHolds.map((h) => ({ ...h, photoUrl: signed(h.photoStoragePath) }))}
          reminders={initialAttentionItems.map((i) => ({ ...i, photoUrl: signed(i.transaction.photoStoragePath) }))}
          unassigned={unassignedFiles.map((f) => ({ ...f, photoUrl: signed(f.photoStoragePath) }))}
          relists={relistsToAcknowledge.map((r) => ({ ...r, photoUrl: signed(r.photoStoragePath) }))}
          chainSetup={chainSetupPending.map((f) => ({ ...f, photoUrl: signed(f.photoStoragePath) }))}
        />
      </AnimatedSection>
    </SectionReveal>
  );
}

// ── Hub-card row formatting (shared by the two lightweight list cards) ───────

function fmtShortDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// The "how urgent" chip: an expiring/quiet file that's close to (or past)
// exchange is the real worry; one far off is routine.
function exchangeMeta(exchangeDate: Date | null): { text: string | null; tone: "muted" | "warning" } {
  if (!exchangeDate) return { text: null, tone: "muted" };
  const days = Math.floor((exchangeDate.getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: "Past its exchange target", tone: "warning" };
  if (days <= 30) return { text: `Near exchange · around ${fmtShortDate(exchangeDate)}`, tone: "warning" };
  return { text: `Exchange around ${fmtShortDate(exchangeDate)}`, tone: "muted" };
}

function buildGoneQuietRows(
  items: Awaited<ReturnType<typeof getGoneQuietFiles>>,
  photoMap: Map<string, string>,
): HubRowData[] {
  return items.map((i) => {
    const meta = exchangeMeta(i.exchangeDate);
    return {
      transactionId: i.transactionId,
      href: `/agent/transactions/${i.transactionId}`,
      photoUrl: i.photoStoragePath ? photoMap.get(i.photoStoragePath) ?? null : null,
      address: i.propertyAddress,
      pillLabel: i.pillLabel,
      pillTone: "muted" as HubRowTone,
      subtext: i.subtext,
      meta: meta.text,
      metaTone: meta.tone,
      dismissSignature: "quiet",
    };
  });
}

function buildMortgageRows(
  items: Awaited<ReturnType<typeof getUpcomingMortgageExpiries>>,
  photoMap: Map<string, string>,
): HubRowData[] {
  const todayMs = new Date().setHours(0, 0, 0, 0);
  return items.map((i) => {
    const days = Math.floor((new Date(i.expiryDate).setHours(0, 0, 0, 0) - todayMs) / 86400000);
    const pillLabel = days < 0
      ? (days === -1 ? "Expired yesterday" : `Expired ${-days} days ago`)
      : days === 0 ? "Expires today"
      : days === 1 ? "Expires tomorrow"
      : `${days} days left`;
    const pillTone: HubRowTone = days < 0 || days <= 7 ? "danger" : days <= 21 ? "warning" : "coral";
    const meta = exchangeMeta(i.exchangeDate);
    return {
      transactionId: i.transactionId,
      href: `/agent/transactions/${i.transactionId}`,
      photoUrl: i.photoStoragePath ? photoMap.get(i.photoStoragePath) ?? null : null,
      address: i.propertyAddress,
      pillLabel,
      pillTone,
      subtext: `${i.clientLabel} ${i.side === "seller_onward" ? "onward offer" : "offer"} · expires ${new Date(i.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      meta: meta.text,
      metaTone: meta.tone,
      dismissSignature: `${i.side}:${new Date(i.expiryDate).toISOString().slice(0, 10)}`,
    };
  });
}

// Fetches both lower cards together so a property shows in at most one place:
// Needs-attention wins, then mortgage (a hard deadline), then gone-quiet.
async function LowerHubCards({ vis, attentionTxIds }: { vis: AgentVisibility; attentionTxIds: string[] }) {
  const mortgage = await getUpcomingMortgageExpiries(vis, attentionTxIds);
  const mortgageTxIds = mortgage.map((m) => m.transactionId);
  // Gone quiet is internal-staff only for now; also drop anything already shown
  // in mortgage above it.
  const goneQuiet = vis.internalMode
    ? await getGoneQuietFiles(vis, [...attentionTxIds, ...mortgageTxIds])
    : [];
  if (goneQuiet.length === 0 && mortgage.length === 0) return null;

  const photoMap = await getSignedUrlMap([
    ...goneQuiet.map((i) => i.photoStoragePath),
    ...mortgage.map((i) => i.photoStoragePath),
  ]);

  return (
    <>
      {goneQuiet.length > 0 && (
        <HubListCard
          cardKind="gone_quiet"
          iconName="clock"
          headerTone="muted"
          title="Gone quiet"
          subtitle={goneQuiet.length === 1 ? "1 file has gone quiet and may need a personal nudge." : `${goneQuiet.length} files have gone quiet and may need a personal nudge.`}
          rows={buildGoneQuietRows(goneQuiet, photoMap)}
        />
      )}
      {mortgage.length > 0 && (
        <HubListCard
          cardKind="mortgage_expiry"
          iconName="bank"
          headerTone="warning"
          title="Mortgage offers expiring"
          subtitle={mortgage.length === 1 ? "1 client mortgage offer is nearing its expiry." : `${mortgage.length} client mortgage offers are nearing their expiry.`}
          rows={buildMortgageRows(mortgage, photoMap)}
        />
      )}
    </>
  );
}

async function PipelineStagesSlot({ vis }: { vis: AgentVisibility }) {
  const pipelineStages = await getHubPipelineStages(vis);
  return (
    <SectionReveal order={2}>
      <PipelineAtAGlance stages={pipelineStages} />
    </SectionReveal>
  );
}

async function PipelineHealthCard({
  ctx, initialPipelineStats, initialAttentionItems,
}: {
  ctx: Ctx;
  initialPipelineStats: Awaited<ReturnType<typeof getHubPipelineStats>>;
  initialAttentionItems: Awaited<ReturnType<typeof getHubAttentionItems>>;
}) {
  const pipelineStats = initialPipelineStats;
  const attentionItems = initialAttentionItems;
  const escalatedCount    = attentionItems.filter((i) => i.urgency === "escalated").length;
  const attentionFileCount = new Set(attentionItems.map((i) => i.transaction.id)).size;
  const { isAdmin, isProgressor } = ctx;

  return (
    <SectionReveal order={3}>
      <GlassCard glassId="hub-pipeline-health" label="Hub · Pipeline health" defaultVariant="v05" style={{ padding: "20px 24px", borderRadius: "var(--agent-radius-xl)" }}>
        <div className="agent-card-hdr-internal" style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Pipeline health</p>
            <p className="agent-card-subtitle">
              {isAdmin ? "Platform-wide pipeline at a glance." : isProgressor ? "Your assigned files at a glance." : "Where your business stands today."}
            </p>
          </div>
        </div>

        <div className="hub-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {(
            [
              {
                value: pipelineStats.activeFiles.toLocaleString(),
                label: "Active files",
                color: "var(--agent-coral)",
                href: "/agent/transactions",
                delta: pipelineStats.newThisMonth > 0 ? `+${pipelineStats.newThisMonth} this month` : null,
                deltaTone: "up" as const,
              },
              {
                value: pipelineStats.exchangingSoon.toLocaleString(),
                label: "Exchanging soon",
                color: "var(--agent-success)",
                href: pipelineStats.exchangingSoon > 0 ? "/agent/transactions?filter=exchanging-next-30-days" : null,
                delta: pipelineStats.comingUp.exchangingThisWeek > 0
                  ? `${pipelineStats.comingUp.exchangingThisWeek} this week`
                  : null,
                deltaTone: "up" as const,
              },
              {
                value: attentionFileCount.toLocaleString(),
                label: "Need attention",
                color: escalatedCount > 0 ? "var(--agent-danger)" : attentionFileCount > 0 ? "var(--agent-warning)" : "var(--agent-text-primary)",
                href: attentionFileCount > 0 ? "/agent/work-queue" : null,
                delta: escalatedCount > 0
                  ? `${escalatedCount} escalated`
                  : attentionFileCount === 0 ? "All clear" : null,
                deltaTone: (escalatedCount > 0 ? "down" : "up") as "up" | "down" | "flat",
              },
              {
                value: fmtCurrency(pipelineStats.pipelineValuePence),
                label: "Pipeline value",
                color: "var(--agent-text-primary)",
                href: null,
                delta: pipelineStats.comingUp.closingThisMonth.total > 0
                  ? `${fmtCurrency(pipelineStats.comingUp.closingThisMonth.total)} this month`
                  : null,
                deltaTone: "up" as const,
              },
            ] as { value: string; label: string; color: string; href: string | null; delta: string | null; deltaTone: "up" | "down" | "flat" }[]
          ).map(({ value, label, color, href, delta, deltaTone }, i) => {
            const inner = (
              <>
                <span style={{
                  fontSize: 22, fontWeight: 600, color,
                  lineHeight: 1, letterSpacing: "-0.01em",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {value}
                </span>
                <span style={{
                  fontSize: 11, color: "var(--agent-text-muted)",
                  textAlign: "center", lineHeight: 1.3,
                }}>
                  {label}
                </span>
                {delta && (
                  <span style={{
                    fontSize: 10,
                    color: deltaTone === "down"
                      ? "var(--agent-warning)"
                      : deltaTone === "flat"
                        ? "var(--agent-text-muted)"
                        : "var(--agent-success)",
                    fontWeight: 500, textAlign: "center",
                  }}>
                    {delta}
                  </span>
                )}
              </>
            );
            const cellStyle: React.CSSProperties = {
              display: "flex", flexDirection: "column",
              alignItems: "center", padding: "6px 12px", gap: 4,
              borderLeft: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined,
              borderRadius: 8,
            };
            return href ? (
              <Link
                key={i}
                href={href}
                style={{ ...cellStyle, textDecoration: "none" }}
                className="agent-press-cell"
                aria-label={label}
              >
                {inner}
              </Link>
            ) : (
              <div key={i} style={cellStyle} aria-label={label}>{inner}</div>
            );
          })}
        </div>

        {/* Coming up strip */}
        <div style={{
          borderTop: "1px solid var(--agent-border-subtle)",
          marginTop: 14, paddingTop: 10, paddingBottom: 2,
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-secondary)", whiteSpace: "nowrap" }}>
            Coming up:
          </span>

          <Link
            href="/agent/transactions?filter=exchanging-this-week"
            style={{
              fontSize: 13,
              color: pipelineStats.comingUp.exchangingThisWeek === 0
                ? "var(--agent-text-muted)"
                : "var(--agent-text-secondary)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
            className="coming-up-link"
          >
            {pipelineStats.comingUp.exchangingThisWeek} exchanging this week
          </Link>
          <span style={{ color: "var(--agent-border-subtle)", fontSize: 13, userSelect: "none" }}>·</span>
          <Link
            href="/agent/transactions?filter=completing-this-week"
            style={{
              fontSize: 13,
              color: pipelineStats.comingUp.completingThisWeek === 0
                ? "var(--agent-text-muted)"
                : "var(--agent-text-secondary)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
            className="coming-up-link"
          >
            {pipelineStats.comingUp.completingThisWeek} completing this week
          </Link>
          <span style={{ color: "var(--agent-border-subtle)", fontSize: 13, userSelect: "none" }}>·</span>
          <Link
            href="/agent/transactions?filter=closing-this-month"
            style={{
              fontSize: 13,
              color: pipelineStats.comingUp.closingThisMonth.total === 0
                ? "var(--agent-text-muted)"
                : "var(--agent-text-secondary)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
            className="coming-up-link"
          >
            {fmtCompact(pipelineStats.comingUp.closingThisMonth.total)} closing this month
          </Link>
        </div>

        {/* Stalled files row */}
        <div style={{ borderTop: "1px solid var(--agent-border-subtle)", marginTop: 10 }}>
          {pipelineStats.stalled.count === 0 ? (
            <div style={{ paddingTop: 10, paddingBottom: 2, fontSize: 13, color: "var(--agent-text-muted)" }}>
              All files have recent activity
            </div>
          ) : (
            <Link
              href="/agent/work-queue"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px", marginTop: 8,
                textDecoration: "none", borderRadius: 6, gap: 8,
              }}
              className="agent-press-cell"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Warning size={14} color="var(--agent-warning)" weight="fill" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--agent-text-primary)" }}>
                  <strong>{pipelineStats.stalled.count} files need chasing</strong>
                  {", "}
                  <span style={{ color: "var(--agent-text-secondary)" }}>nothing logged in 14+ days</span>
                </span>
              </div>
              <CaretRight size={14} color="var(--agent-text-muted)" weight="bold" style={{ flexShrink: 0 }} />
            </Link>
          )}
        </div>
      </GlassCard>
    </SectionReveal>
  );
}

async function WinsCardSlot({ vis }: { vis: AgentVisibility }) {
  const wins = await getHubWins(vis);
  return (
    <SectionReveal order={4}>
      <GlassCard glassId="hub-wins" label="Hub · Wins this month" defaultVariant="v05" style={{ padding: "20px 24px", borderRadius: "var(--agent-radius-xl)" }}>
        <WinsCard wins={wins} />
      </GlassCard>
    </SectionReveal>
  );
}

async function ExchangeForecastCard({ ctx }: { ctx: Ctx }) {
  const weeklyForecast = await getHubWeeklyForecast(ctx.vis);
  const next7Days  = weeklyForecast[0]?.count ?? 0;
  const next30Days = weeklyForecast.reduce((s, w) => s + w.count, 0);
  const { isAdmin, isProgressor } = ctx;
  return (
    <SectionReveal order={5}>
      <GlassCard glassId="hub-exchange-forecast" label="Hub · Exchange forecast" defaultVariant="v05" style={{ padding: "20px 24px", borderRadius: "var(--agent-radius-xl)" }}>
        <div className="agent-card-hdr-internal">
          <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Exchange forecast</p>
          <p className="agent-card-subtitle">
            {isAdmin ? "Platform-wide exchange forecast." : isProgressor ? "Exchange forecast for your assigned files." : "When your files are due to exchange."}
          </p>
        </div>

        {next30Days === 0 ? (
          <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: "0 0 16px", lineHeight: 1.6 }}>
            No exchange dates in the next 30 days. Add expected exchange dates to your files to see them here.
          </p>
        ) : (
          <>
            <ExchangeForecastChart data={weeklyForecast} />
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 6, marginBottom: 4 }}>
              {weeklyForecast.map((w, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 10, color: w.isCurrentWeek ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
                    fontWeight: w.isCurrentWeek ? 600 : 400,
                    textAlign: "center", flex: 1,
                  }}
                >
                  {w.label}
                </span>
              ))}
            </div>
          </>
        )}

        <div style={{
          borderTop: "0.5px solid var(--agent-border-subtle)",
          paddingTop: 12,
          marginTop: next30Days === 0 ? 4 : 8,
        }}>
          {[
            { label: "This week", count: next7Days },
            { label: "Next 30 days", count: next30Days },
          ].map(({ label, count }) => (
            <div
              key={label}
              style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}
            >
              <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)" }}>
                {label}
              </p>
              <p style={{
                margin: 0, fontSize: 12, fontWeight: 600,
                color: label === "This week" && count > 0 ? "var(--agent-coral-deep)" : "var(--agent-text-primary)",
              }}>
                {count} {count === 1 ? "exchange" : "exchanges"}
              </p>
            </div>
          ))}
          {next7Days > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--agent-coral-deep)", fontWeight: 500 }}>
              {next7Days === 1 ? "1 exchange this week. Check files are ready." : `${next7Days} exchanges this week. Check all files are ready.`}
            </p>
          )}
        </div>
      </GlassCard>
    </SectionReveal>
  );
}

async function ServiceSplitCard({ ctx }: { ctx: Ctx }) {
  const serviceSplit = await getHubServiceSplit(ctx.vis);
  const savedHours = Math.round(serviceSplit.outsourced * 2.5);
  const { isAdmin } = ctx;
  return (
    <SectionReveal order={6}>
      <GlassCard glassId="hub-service-split" label="Hub · Service split" defaultVariant="v05" data-testid="hub-service-split" style={{ padding: "20px 24px", borderRadius: "var(--agent-radius-xl)" }}>
        <div className="agent-card-hdr-internal">
          <p className="agent-eyebrow" style={{ marginBottom: 2 }}>{isAdmin ? "Service split" : "Who's managing"}</p>
          <p className="agent-card-subtitle">{isAdmin ? "Self-managed by agencies vs. outsourced to us." : "Files you manage and files our team handles."}</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 4 }}>
          <ServiceSplitDonut
            selfManaged={serviceSplit.selfManaged}
            outsourced={serviceSplit.outsourced}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            {(() => {
              const total = serviceSplit.selfManaged + serviceSplit.outsourced;
              return [
                { label: isAdmin ? "Self-managed" : "Managed by you", count: serviceSplit.selfManaged, color: "var(--agent-coral)" },
                { label: isAdmin ? "Outsourced to us" : "Our team",   count: serviceSplit.outsourced,  color: "var(--agent-warning)" },
              ].map(({ label, count, color }) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div
                    key={label}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", flex: 1 }}>
                      {label}
                    </p>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                      {count}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--agent-text-muted)", minWidth: 30, textAlign: "right" }}>
                      {pct}%
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div style={{
          borderTop: "0.5px solid var(--agent-border-subtle)",
          paddingTop: 12, marginTop: 12,
        }}>
          {serviceSplit.outsourced > 0 ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              background: "var(--agent-coral-bg-tint)",
              border: "0.5px solid rgba(var(--agent-coral-base-rgb),0.20)",
              borderRadius: 10,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: "rgba(var(--agent-coral-base-rgb),0.14)",
                color: "var(--agent-coral-deep)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <HouseSimple size={14} weight="fill" />
              </div>
              <p style={{
                margin: 0, fontSize: 12,
                color: "var(--agent-text-secondary)", lineHeight: 1.5,
              }}>
                {isAdmin ? (
                  <>We&apos;re progressing{" "}
                    <strong style={{ color: "var(--agent-text-primary)" }}>
                      {serviceSplit.outsourced} {serviceSplit.outsourced === 1 ? "file" : "files"}
                    </strong>
                    {" "}across all client agencies.
                  </>
                ) : (
                  <>Our team is handling{" "}
                    <strong style={{ color: "var(--agent-text-primary)" }}>
                      {serviceSplit.outsourced} {serviceSplit.outsourced === 1 ? "file" : "files"}
                    </strong>
                    {savedHours > 0 && (
                      <>, saving you around{" "}
                        <strong style={{ color: "var(--agent-coral-deep)" }}>
                          {savedHours} hours
                        </strong>{" "}
                        this week
                      </>
                    )}
                    .
                  </>
                )}
              </p>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.6 }}>
              {isAdmin ? "All files are self-managed by their agencies." : "All files are self-managed."}
            </p>
          )}
        </div>
      </GlassCard>
    </SectionReveal>
  );
}

async function ActivityRibbonSlot({ vis }: { vis: AgentVisibility }) {
  const recentActivity = await getHubRecentActivity(vis);
  if (!recentActivity) return null;
  const { Icon, bg, color } = pickActivityGlyph(recentActivity.kind, recentActivity.description);
  return (
    <SectionReveal order={7}>
      <GlassCard
        glassId="hub-activity-ribbon"
        label="Hub · Activity ribbon"
        defaultVariant="v05"
        className="hub-activity-ribbon"
        style={{ padding: "12px 20px", borderRadius: "var(--agent-radius-xl)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: bg, color,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "0.5px solid rgba(15,23,42,0.06)",
          }}>
            <Icon size={14} weight="fill" />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 500,
              color: "var(--agent-text-primary)",
            }}>
              Last activity: {recentActivity.description}
            </p>
            <p style={{
              margin: 0, fontSize: 11, color: "var(--agent-text-muted)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {timeAgo(recentActivity.at)} · {recentActivity.context}
            </p>
          </div>
        </div>
        <Link
          href={`/agent/transactions/${recentActivity.transactionId}`}
          className="agent-link"
          style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
        >
          View file
          <ArrowRight size={12} />
        </Link>
      </GlassCard>
    </SectionReveal>
  );
}

async function ProTipSlot({ ctx }: { ctx: Ctx }) {
  const [pipelineStats, attentionItems, weeklyForecast] = await Promise.all([
    getHubPipelineStats(ctx.vis),
    getHubAttentionItems(ctx.vis),
    getHubWeeklyForecast(ctx.vis),
  ]);
  const escalatedCount = attentionItems.filter((i) => i.urgency === "escalated").length;
  const attentionFileCount = new Set(attentionItems.map((i) => i.transaction.id)).size;
  const next7Days = weeklyForecast[0]?.count ?? 0;
  const { isAdmin, isProgressor, canCreateSale } = ctx;
  const stalledCount = pipelineStats.stalled.count;

  type Tip = { copy: React.ReactNode; href: string | null };
  let tip: Tip | null = null;
  if (stalledCount > 0) {
    tip = {
      copy: (
        <>
          <strong style={{ color: "var(--agent-text-primary)" }}>
            {stalledCount} {stalledCount === 1 ? "file hasn't" : "files haven't"} had an update in 14+ days.
          </strong>{" "}
          A quick chase now could keep your pipeline moving.
        </>
      ),
      href: "/agent/work-queue",
    };
  } else if (escalatedCount > 0) {
    tip = {
      copy: (
        <>
          <strong style={{ color: "var(--agent-text-primary)" }}>
            {escalatedCount} {escalatedCount === 1 ? "reminder" : "reminders"} escalated.
          </strong>{" "}
          Clearing these first keeps everything downstream on track.
        </>
      ),
      href: "/agent/work-queue",
    };
  } else if (next7Days > 0) {
    tip = {
      copy: (
        <>
          <strong style={{ color: "var(--agent-text-primary)" }}>
            {next7Days} {next7Days === 1 ? "file exchanging" : "files exchanging"} this week.
          </strong>{" "}
          Give each one a final ready-check before Friday.
        </>
      ),
      href: "/agent/transactions?filter=exchanging-this-week",
    };
  } else if (attentionFileCount > 0) {
    tip = {
      copy: (
        <>
          <strong style={{ color: "var(--agent-text-primary)" }}>
            {attentionFileCount} {attentionFileCount === 1 ? "file needs" : "files need"} a bit of attention today.
          </strong>{" "}
          Clearing these before end-of-day is the fastest win.
        </>
      ),
      href: "/agent/work-queue",
    };
  } else if (pipelineStats.activeFiles > 0) {
    if (isAdmin) {
      tip = {
        copy: (
          <>
            <strong style={{ color: "var(--agent-text-primary)" }}>Platform is ticking along nicely.</strong>{" "}
            A good moment to spot-check risk trends or review the analytics view.
          </>
        ),
        href: "/agent/analytics",
      };
    } else if (isProgressor) {
      tip = {
        copy: (
          <>
            <strong style={{ color: "var(--agent-text-primary)" }}>All your assigned files are healthy.</strong>{" "}
            A great moment to spot-check the trickier ones or catch up on notes.
          </>
        ),
        href: "/agent/transactions",
      };
    } else {
      tip = {
        copy: (
          <>
            <strong style={{ color: "var(--agent-text-primary)" }}>Pipeline is looking healthy.</strong>{" "}
            A great moment to add your next sale or nudge a chain forward.
          </>
        ),
        href: canCreateSale ? "/agent/transactions/new" : null,
      };
    }
  }

  if (!tip) return null;

  const inner = (
    <>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: "rgba(245, 158, 11, 0.10)",
        color: "var(--agent-warning)",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "0.5px solid rgba(245, 158, 11, 0.30)",
      }}>
        <Lightbulb size={16} weight="fill" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--agent-warning)",
        }}>
          Pro tip
        </p>
        <p style={{
          margin: "2px 0 0", fontSize: 13,
          color: "var(--agent-text-secondary)", lineHeight: 1.5,
        }}>
          {tip.copy}
        </p>
      </div>
      {tip.href && (
        <ArrowRight size={16} color="var(--agent-text-muted)" weight="bold" style={{ flexShrink: 0 }} />
      )}
    </>
  );

  const wrapperStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 16px",
    background: "var(--agent-protip-bg)",
    border: "0.5px solid rgba(245, 158, 11, 0.22)",
    borderRadius: "var(--agent-radius-xl)",
    textDecoration: "none",
  };

  return (
    <SectionReveal order={8}>
      {tip.href ? (
        <Link href={tip.href} className="agent-hover-row" style={wrapperStyle} data-testid="hub-pro-tip">
          {inner}
        </Link>
      ) : (
        <div style={wrapperStyle} data-testid="hub-pro-tip">{inner}</div>
      )}
    </SectionReveal>
  );
}
