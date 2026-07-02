import type { Metadata } from "next";
import type React from "react";
import { extractFirstName } from "@/lib/contacts/displayName";

export const metadata: Metadata = {
  title: "Hub · Sales Progressor",
  description: "Your pipeline, attention items, and exchange forecast at a glance.",
};

import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import {
  getHubPipelineStats, getHubAttentionItems, getHubWins,
  getHubWeeklyForecast, getHubServiceSplit, getHubRecentActivity, getHubDiary,
  getHubUnassignedFiles, getExpiredHolds, getHubRelistsToAcknowledge, getHubChainSetupPending,
  getHubPipelineStages,
} from "@/lib/services/hub";
import type { DiaryItem } from "@/lib/services/hub";
import { AgentFlagButton } from "@/components/agent/AgentFlagButton";
import {
  ExchangeForecastChart, ServiceSplitDonut,
} from "@/components/hub/HubCharts";
import { WinsCard } from "@/components/hub/WinsCard";
import { PipelineAtAGlance } from "@/components/hub/PipelineAtAGlance";
import { AttentionListView } from "@/components/hub/AttentionListView";
import { UnassignedFilesView } from "@/components/hub/UnassignedFilesView";
import { NewBuyersToAcknowledgeView } from "@/components/hub/NewBuyersToAcknowledgeView";
import { ChainSetupPendingView } from "@/components/hub/ChainSetupPendingView";
import { ExpiredHoldsCard } from "@/components/hub/ExpiredHoldsCard";
import { AnimatedSection } from "@/components/hub/AnimatedSection";
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
    const prefix =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    // PR 5 header: add a waving hand for a warmer read on the daily
    // landing page. Kept out of the greeting variable used in the empty
    // state so the empty branch still reads neutrally.
    return `${prefix}, ${extractFirstName(name)} 👋`;
  } catch {
    return `Hello, ${extractFirstName(name)}`;
  }
}

// PR 5 header: pick a subtitle that matches what the hub is actually
// telling the user, keyed off role. Was previously the flat "Here's what
// matters today." — this reads warmer + more specific.
//
// Uses hasAdminPowers (isAdmin) rather than the raw role string so a
// hybrid admin (director with admin powers) still gets the platform-wide
// subtitle — matches the pipeline-health card's existing subtitle logic.
function getSubtitle(isAdmin: boolean, isProgressor: boolean): string {
  if (isAdmin) {
    return "Here's what's happening across the platform today.";
  }
  if (isProgressor) {
    return "Here's what's happening with your assigned files today.";
  }
  return "Here's what's happening with your pipeline today.";
}

function fmtCurrency(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000_000) return `£${(p / 1_000_000_000).toFixed(2)}bn`;
  if (p >= 1_000_000)     return `£${(p / 1_000_000).toFixed(2)}m`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}

/** Compact currency for "Coming up" strip: £142k / £1.2M / £850 */
function fmtCompact(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (p >= 1_000)     return `£${Math.round(p / 1_000)}k`;
  return `£${Math.round(p)}`;
}

// PR 3 iconography: pick the right icon + tint for the activity ribbon
// based on the kind + description string. The RecentActivity type only
// carries `kind: "comm" | "milestone"` so we pattern-match on the
// server-set description ("Email sent...", "Call logged", etc.) rather
// than change the service shape.
function pickActivityGlyph(kind: "comm" | "milestone", description: string): {
  Icon: typeof CheckCircle;
  bg: string;
  color: string;
} {
  if (kind === "milestone") {
    return {
      Icon: CheckCircle,
      bg: "var(--agent-success-bg)",
      color: "var(--agent-success)",
    };
  }
  const d = description.toLowerCase();
  if (d.includes("whatsapp")) {
    return {
      Icon: ChatCircleText,
      bg: "rgba(37, 211, 102, 0.10)",
      color: "#128c7e",
    };
  }
  if (d.includes("call")) {
    return {
      Icon: Phone,
      bg: "rgba(59, 130, 246, 0.10)",
      color: "#1d4ed8",
    };
  }
  if (d.includes("sms")) {
    return {
      Icon: ChatText,
      bg: "rgba(139, 92, 246, 0.10)",
      color: "#6d28d9",
    };
  }
  // email / letter / update received / default comm
  return {
    Icon: Envelope,
    bg: "var(--agent-coral-bg-tint)",
    color: "var(--agent-coral-deep)",
  };
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

// ── Config ────────────────────────────────────────────────────────────────────



// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HubPreviewPage() {
  const session = await requireSession();
  const role = session.user.role;
  const isInternalStaff = role === "admin" || role === "sales_progressor" || role === "viewer";
  const isProgressor    = role === "sales_progressor";
  const isAdmin         = hasAdminPowers(session);
  const canCreateSale   = role === "director" || role === "negotiator" || role === "admin";

  // Internal staff use a separate visibility resolver (no DB query, scope set by role).
  // Agent callers (director/negotiator) use the original resolver unchanged.
  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, role, isAdmin)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const [pipelineStats, attentionItems, wins, weeklyForecast, serviceSplit, recentActivity, diaryItems, unassignedFiles, expiredHolds, relistsToAcknowledge, chainSetupPending, pipelineStages] =
    await Promise.all([
      getHubPipelineStats(vis),
      getHubAttentionItems(vis),
      getHubWins(vis),
      getHubWeeklyForecast(vis),
      getHubServiceSplit(vis),
      getHubRecentActivity(vis),
      getHubDiary(vis),
      getHubUnassignedFiles(vis),
      getExpiredHolds(vis),
      getHubRelistsToAcknowledge(vis),
      getHubChainSetupPending(vis),
      getHubPipelineStages(vis),
    ]);

  // Derived values
  const escalatedCount    = attentionItems.filter((i) => i.urgency === "escalated").length;
  const overdueCount      = attentionItems.filter((i) => i.urgency === "overdue").length;
  const attentionFileCount = new Set(attentionItems.map((i) => i.transaction.id)).size;
  const healthStatus      = escalatedCount > 0 ? "action" : overdueCount > 0 ? "watch" : "on_track";
  const next7Days      = weeklyForecast[0]?.count ?? 0;
  const next30Days     = weeklyForecast.reduce((s, w) => s + w.count, 0);
  const savedHours     = Math.round(serviceSplit.outsourced * 2.5);
  const greeting       = getGreeting(session.user.name ?? "there");
  const subtitle       = getSubtitle(isAdmin, isProgressor);
  const isEmpty        = pipelineStats.activeFiles === 0 && attentionItems.length === 0;

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        <PageHeader title={greeting} subtitle={subtitle}>
          {canCreateSale && (
            <Link href="/agent/transactions/new-v2" className="agent-btn agent-btn-primary agent-btn-sm" style={{ textDecoration: "none" }}>
              <Plus size={14} weight="bold" />
              New sale
            </Link>
          )}
          {!isInternalStaff && (
            <AgentFlagButton transactionId={null} address="general" label="Send a note to our team" />
          )}
        </PageHeader>

        {/* Content: welcome card + ghost cards */}
        <div style={{ padding: "8px 32px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Welcome CTA */}
          <div className="agent-glass" style={{
            padding: "28px 32px", borderRadius: "var(--agent-radius-xl)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
          }}>
            <div>
              <p style={{
                margin: "0 0 4px",
                fontSize: "var(--agent-text-h3)", fontWeight: 600,
                color: "var(--agent-text-primary)",
                letterSpacing: "var(--agent-tracking-tight)",
              }}>
                {isProgressor ? "No assigned files yet." : "Add your first sale to start your pipeline."}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
                {isProgressor
                  ? "Files assigned to you will appear here."
                  : "Add your first sale. Track each one from offer through to completion."}
              </p>
            </div>
            {canCreateSale && (
              <Link
                href="/agent/transactions/new-v2"
                className="agent-btn agent-btn-primary agent-btn-md"
                style={{ textDecoration: "none", flexShrink: 0 }}
              >
                <Plus size={16} weight="bold" />
                Add a sale
              </Link>
            )}
          </div>

          {/* Ghost pipeline health + momentum */}
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
      </div>
    );
  }

  // ── Full hub ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      <PageHeader title={greeting} subtitle="Here's what matters today.">
        {canCreateSale && (
          <Link href="/agent/transactions/new-v2" className="agent-btn agent-btn-primary agent-btn-sm" style={{ textDecoration: "none" }}>
            <Plus size={14} weight="bold" />
            New sale
          </Link>
        )}
        {!isInternalStaff && (
          <AgentFlagButton
            transactionId={null}
            address="general"
            label="Send a note to our team"
          />
        )}
      </PageHeader>

      {/* ── Content ────────────────────────────────────────────────────────────── */}
      <div className="hub-content-pad" style={{ padding: "8px 32px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Payments — failed-payment warning or block notice ─────────────────── */}
        {/* Self-hides for non-directors and for "ok" state. Hub is the right
            surface — it's the first page a director sees after login. */}
        {role === "director" && session.user.agencyId && (
          <PaymentBlockBanner agencyId={session.user.agencyId} />
        )}

        {/* ── Payments — gentle nudge to set up a card after trial + 7d grace ───── */}
        {/* Self-hides during trial, immediately after trial (1-week orientation
            window), and once a card is on file. Director-only. */}
        {role === "director" && session.user.agencyId && (
          <PaymentMethodNudge agencyId={session.user.agencyId} />
        )}

        {/* ── 2. Today's diary ──────────────────────────────────────────────────── */}
        {diaryItems.length > 0 && (
          <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
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
              <Link
                key={item.transactionId}
                href={`/agent/transactions/${item.transactionId}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "13px 20px 13px 17px",
                  borderLeft: `3px solid ${item.type === "completion" ? "var(--agent-success)" : "var(--agent-coral)"}`,
                  background: item.type === "completion" ? "var(--agent-success-bg)" : "var(--agent-coral-bg-tint)",
                  borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                  textDecoration: "none", gap: 12,
                }}
                className="agent-hover-row"
              >
                <p style={{
                  margin: 0, fontSize: 12, fontWeight: 500,
                  color: "var(--agent-text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {item.address}
                </p>
                <span style={{
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                  color: item.type === "completion" ? "var(--agent-success)" : "var(--agent-coral-deep)",
                }}>
                  {item.type === "completion" ? "Completion" : "Exchange"}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* ── 3-5. Attention stack — wrapped so when ExpiredHoldsCard
          * collapses out, AttentionListView + UnassignedFilesView shift
          * up smoothly instead of snapping. ────────────────────────── */}
        <AnimatedSection>
          <ExpiredHoldsCard initialItems={expiredHolds} />
          <AttentionListView items={attentionItems} />
          <UnassignedFilesView initialFiles={unassignedFiles} />
          <NewBuyersToAcknowledgeView initialRounds={relistsToAcknowledge} />
          <ChainSetupPendingView initialFiles={chainSetupPending} />
        </AnimatedSection>

        {/* ── 4b. Pipeline at a glance — hub polish PR 2 ─────────────────────────
          * Five connected stage circles (New → Legals → Ready → Exchanging →
          * Completed) as a horizontal-flow visualization. Data from
          * getHubPipelineStages(vis). */}
        <PipelineAtAGlance stages={pipelineStages} />

        {/* ── 5. Pipeline health + Wins this month ──────────────────────────── */}
        <div className="hub-grid-main" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>

          {/* Pipeline health card */}
          <div className="agent-glass" style={{ padding: "20px 24px" }}>
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
                    // PR 4 trend: subset carved out from exchangingSoon (30d
                    // window). Free — data already in comingUp.
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
                    // PR 4 trend: escalated count already computed at the top
                    // of the render. Escalated files are the loudest signal.
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
                    // PR 4 trend: closing this month (in pence, format for
                    // readability). Data already computed via comingUp.
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
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={i} style={cellStyle}>{inner}</div>
                );
              })}
            </div>

            {/* ── Coming up strip ─────────────────────────────────────────────── */}
            <div style={{
              borderTop: "1px solid var(--agent-border-subtle)",
              marginTop: 14,
              paddingTop: 10,
              paddingBottom: 2,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--agent-text-secondary)",
                whiteSpace: "nowrap",
              }}>
                Coming up:
              </span>

              {/* Exchanging this week */}
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

              {/* Completing this week */}
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

              {/* Closing this month (currency) */}
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

            {/* ── Stalled files row ───────────────────────────────────────────── */}
            <div style={{
              borderTop: "1px solid var(--agent-border-subtle)",
              marginTop: 10,
            }}>
              {pipelineStats.stalled.count === 0 ? (
                <div style={{
                  paddingTop: 10,
                  paddingBottom: 2,
                  fontSize: 13,
                  color: "var(--agent-text-muted)",
                }}>
                  All files have recent activity
                </div>
              ) : (
                <Link
                  href="/agent/work-queue"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px",
                    marginTop: 8,
                    textDecoration: "none",
                    borderRadius: 6,
                    gap: 8,
                  }}
                  className="agent-press-cell"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Warning
                      size={14}
                      color="var(--agent-warning)"
                      weight="fill"
                      style={{ flexShrink: 0 }}
                    />
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
          </div>

          {/* Wins card — replaces the old Momentum card. Cascade tiers
              inside pick what to celebrate (exchanges → completions →
              steps confirmed → brand-new fallback). */}
          <WinsCard wins={wins} />
        </div>

        {/* ── 4. Exchange forecast + Service split ───────────────────────────────── */}
        {/* Service split is hidden for sales_progressor (all their files are outsourced by definition) */}
        <div className="hub-grid-half" style={{ display: "grid", gridTemplateColumns: (isProgressor && !isAdmin) ? "1fr" : "1fr 1fr", gap: 16 }}>

          {/* Exchange forecast */}
          <div className="agent-glass" style={{ padding: "20px 24px" }}>
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
                {/* PR 3 iconography: house icon caps above each forecast bar
                    keyed to the count (filled for current week + any bar with
                    exchanges, outlined otherwise). Mirrors the mock's
                    "house on the roofline" motif. */}
                <div style={{
                  display: "flex", justifyContent: "space-around",
                  marginBottom: 4,
                }}>
                  {weeklyForecast.map((w, i) => (
                    <div key={i} style={{
                      flex: 1, display: "flex", justifyContent: "center",
                      color: w.isCurrentWeek
                        ? "var(--agent-coral-deep)"
                        : w.count > 0
                          ? "var(--agent-coral)"
                          : "var(--agent-text-muted)",
                      opacity: w.count === 0 ? 0.4 : 1,
                    }}>
                      <HouseSimple
                        size={16}
                        weight={w.isCurrentWeek || w.count > 0 ? "fill" : "regular"}
                      />
                    </div>
                  ))}
                </div>
                <ExchangeForecastChart data={weeklyForecast} />
                <div style={{
                  display: "flex", justifyContent: "space-around",
                  marginTop: 6, marginBottom: 4,
                }}>
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
                  style={{
                    display: "flex", justifyContent: "space-between",
                    marginBottom: 4,
                  }}
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
          </div>

          {/* Service split — hidden for sales_progressor; relabelled for admin */}
          {(!isProgressor || isAdmin) && <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div className="agent-card-hdr-internal">
              <p className="agent-eyebrow" style={{ marginBottom: 2 }}>{isAdmin ? "Service split" : "Who’s managing"}</p>
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
                        <div style={{
                          width: 10, height: 10, borderRadius: 2,
                          background: color, flexShrink: 0,
                        }} />
                        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", flex: 1 }}>
                          {label}
                        </p>
                        <span style={{
                          fontSize: 13, fontWeight: 600,
                          color: "var(--agent-text-primary)",
                        }}>
                          {count}
                        </span>
                        <span style={{
                          fontSize: 11, color: "var(--agent-text-muted)",
                          minWidth: 30, textAlign: "right",
                        }}>
                          {pct}%
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* PR 4 info pill: role-specific service-split summary sits in a
                tinted pill row rather than a paragraph, so it reads as a
                distinct fact rather than a caption. */}
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
          </div>}
        </div>

        {/* ── 5. Activity ribbon ─────────────────────────────────────────────────── */}
        {recentActivity && (
          <div
            className="agent-glass-light hub-activity-ribbon"
            style={{ padding: "12px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              {(() => {
                // PR 3 iconography: per-type icon on activity ribbon.
                const { Icon, bg, color } = pickActivityGlyph(recentActivity.kind, recentActivity.description);
                return (
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: bg,
                    color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "0.5px solid rgba(15,23,42,0.06)",
                  }}>
                    <Icon size={14} weight="fill" />
                  </div>
                );
              })()}
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
          </div>
        )}

        {/* ── 6. Pro tip banner (hub polish PR 5) ─────────────────────────────
          * Contextual nudge picked from the current state of the pipeline.
          * The cascade fires the loudest signal first (stalled → escalated →
          * exchanging-this-week → attention count) and falls through to a
          * neutral-positive fallback when the pipeline is quiet. */}
        {(() => {
          type Tip = { copy: React.ReactNode; href: string | null };
          const stalledCount = pipelineStats.stalled.count;

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
            // Role-branched copy for the "healthy pipeline" tier — the
            // generic "add your next sale" nudge is agent-centric and
            // doesn't fit the progressor (can't create sales) or admin
            // (platform view, not their own pipeline to add to).
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
                href: canCreateSale ? "/agent/transactions/new-v2" : null,
              };
            }
          }

          if (!tip) return null;

          const inner = (
            <>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: "rgba(245, 158, 11, 0.10)",
                color: "#b45309",
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
                  color: "#b45309",
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
                <ArrowRight
                  size={16}
                  color="var(--agent-text-muted)"
                  weight="bold"
                  style={{ flexShrink: 0 }}
                />
              )}
            </>
          );

          const wrapperStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "rgba(255, 251, 235, 0.75)",
            border: "0.5px solid rgba(245, 158, 11, 0.22)",
            borderRadius: "var(--agent-radius-xl)",
            textDecoration: "none",
          };

          return tip.href ? (
            <Link href={tip.href} className="agent-hover-row" style={wrapperStyle}>
              {inner}
            </Link>
          ) : (
            <div style={wrapperStyle}>{inner}</div>
          );
        })()}
      </div>
    </div>
  );
}
