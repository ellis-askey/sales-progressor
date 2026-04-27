import type { Metadata } from "next";
import type React from "react";

export const metadata: Metadata = {
  title: "Hub · Sales Progressor",
  description: "Your pipeline, attention items, and exchange forecast at a glance.",
};

import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import {
  getHubPipelineStats, getHubAttentionItems, getHubMomentum,
  getHubWeeklyForecast, getHubServiceSplit, getHubRecentActivity, getHubDiary,
} from "@/lib/services/hub";
import type { DiaryItem } from "@/lib/services/hub";
import { AgentFlagButton } from "@/components/agent/AgentFlagButton";
import {
  ExchangeForecastChart, ServiceSplitDonut,
  MomentumRing, RefreshButton,
} from "@/components/hub/HubCharts";
import Link from "next/link";
import { Plus, Clock, ArrowRight } from "@phosphor-icons/react/dist/ssr";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(name: string): string {
  try {
    const hourStr = new Date().toLocaleString("en-GB", {
      timeZone: "Europe/London", hour: "numeric", hour12: false,
    });
    const hour = parseInt(hourStr, 10);
    const prefix =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return `${prefix}, ${name.split(" ")[0]}`;
  } catch {
    return `Hello, ${name.split(" ")[0]}`;
  }
}

function fmtCurrency(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000_000) return `£${(p / 1_000_000_000).toFixed(2)}bn`;
  if (p >= 1_000_000)     return `£${(p / 1_000_000).toFixed(2)}m`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}

function formatAsOf(date: Date): string {
  try {
    return date.toLocaleTimeString("en-GB", {
      timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch {
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  }
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

const URGENCY_STYLE = {
  escalated: {
    border: "var(--agent-danger)",
    bg:     "rgba(199,62,62,0.05)",
    color:  "var(--agent-danger)",
    label:  "Escalated",
  },
  overdue: {
    border: "var(--agent-warning)",
    bg:     "rgba(201,125,26,0.05)",
    color:  "var(--agent-warning)",
    label:  "Overdue",
  },
  due_today: {
    border: "var(--agent-coral)",
    bg:     "var(--agent-coral-bg-tint)",
    color:  "var(--agent-coral-deep)",
    label:  "Due today",
  },
} as const;

const HEALTH_BADGE = {
  on_track: {
    bg:     "var(--agent-success-bg)",
    color:  "var(--agent-success)",
    border: "var(--agent-success-border)",
    label:  "On track",
  },
  watch: {
    bg:     "var(--agent-warning-bg)",
    color:  "var(--agent-warning)",
    border: "var(--agent-warning-border)",
    label:  "Watch",
  },
  action: {
    bg:     "var(--agent-danger-bg)",
    color:  "var(--agent-danger)",
    border: "var(--agent-danger-border)",
    label:  "Action needed",
  },
} as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HubPreviewPage() {
  const session = await requireSession();
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const [pipelineStats, attentionItems, momentum, weeklyForecast, serviceSplit, recentActivity, diaryItems] =
    await Promise.all([
      getHubPipelineStats(vis),
      getHubAttentionItems(vis),
      getHubMomentum(vis),
      getHubWeeklyForecast(vis),
      getHubServiceSplit(vis),
      getHubRecentActivity(vis),
      getHubDiary(vis),
    ]);

  // Derived values
  const escalatedCount    = attentionItems.filter((i) => i.urgency === "escalated").length;
  const overdueCount      = attentionItems.filter((i) => i.urgency === "overdue").length;
  const attentionFileCount = new Set(attentionItems.map((i) => i.transaction.id)).size;
  const healthStatus      = escalatedCount > 0 ? "action" : overdueCount > 0 ? "watch" : "on_track";
  const healthBadge    = HEALTH_BADGE[healthStatus];
  const next7Days      = weeklyForecast[0]?.count ?? 0;
  const next30Days     = weeklyForecast.reduce((s, w) => s + w.count, 0);
  const savedHours     = Math.round(serviceSplit.outsourced * 2.5);
  const updatedAt      = new Date();
  const greeting       = getGreeting(session.user.name ?? "there");
  const isEmpty        = pipelineStats.activeFiles === 0 && attentionItems.length === 0;

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header — same as full hub */}
        <div
          className="agent-glass-strong"
          style={{
            padding: "22px 32px 26px",
            borderBottom: "0.5px solid var(--agent-glass-border)",
            position: "relative", overflow: "hidden",
          }}
        >
          <div aria-hidden="true" style={{
            position: "absolute", top: -70, right: -50,
            width: 280, height: 280, borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)",
          }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <RefreshButton updatedLabel={`As of ${formatAsOf(updatedAt)}`} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <h1 style={{
                  margin: 0,
                  fontSize: "var(--agent-text-h2)",
                  fontWeight: "var(--agent-weight-semibold)",
                  color: "var(--agent-text-primary)",
                  letterSpacing: "var(--agent-tracking-tight)",
                  lineHeight: "var(--agent-line-tight)",
                }}>
                  {greeting}
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-tertiary)" }}>
                  Here&apos;s what matters today.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Link
                  href="/agent/transactions/new"
                  className="agent-btn agent-btn-primary agent-btn-md"
                  style={{ textDecoration: "none" }}
                >
                  <Plus size={16} weight="bold" />
                  New sale
                </Link>
                <AgentFlagButton transactionId={null} address="general" label="Send note to progressor" />
              </div>
            </div>
          </div>
        </div>

        {/* Content: welcome card + ghost cards */}
        <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

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
                Your pipeline starts here.
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
                Add your first sale and we&apos;ll track it from offer to completion.
              </p>
            </div>
            <Link
              href="/agent/transactions/new"
              className="agent-btn agent-btn-primary agent-btn-md"
              style={{ textDecoration: "none", flexShrink: 0 }}
            >
              <Plus size={16} weight="bold" />
              Add a sale
            </Link>
          </div>

          {/* Ghost pipeline health + momentum */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, opacity: 0.3, pointerEvents: "none" }}>
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
              <p className="agent-eyebrow" style={{ marginBottom: 16 }}>Momentum</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 8, paddingBottom: 8 }}>
                <div className="agent-skeleton" style={{ width: 80, height: 80, borderRadius: "50%" }} />
              </div>
            </div>
          </div>

          {/* Ghost attention */}
          <div
            className="agent-glass-strong"
            style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden", opacity: 0.3, pointerEvents: "none" }}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, opacity: 0.3, pointerEvents: "none" }}>
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
              <p className="agent-eyebrow" style={{ marginBottom: 16 }}>Service split</p>
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

      {/* ── 1. Header ─────────────────────────────────────────────────────────── */}
      <div
        className="agent-glass-strong hub-header-pad"
        style={{
          padding: "22px 32px 26px",
          borderBottom: "0.5px solid var(--agent-glass-border)",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Ambient coral bloom */}
        <div aria-hidden="true" style={{
          position: "absolute", top: -70, right: -50,
          width: 280, height: 280, borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)",
        }} />

        <div style={{ position: "relative" }}>
          {/* Refresh timestamp */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <RefreshButton updatedLabel={`As of ${formatAsOf(updatedAt)}`} />
          </div>

          {/* Greeting + actions */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: "var(--agent-text-h2)",
                fontWeight: "var(--agent-weight-semibold)",
                color: "var(--agent-text-primary)",
                letterSpacing: "var(--agent-tracking-tight)",
                lineHeight: "var(--agent-line-tight)",
              }}>
                {greeting}
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-tertiary)" }}>
                Here&apos;s what matters today.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <Link
                href="/agent/transactions/new"
                className="agent-btn agent-btn-primary agent-btn-md"
                style={{ textDecoration: "none" }}
              >
                <Plus size={16} weight="bold" />
                New sale
              </Link>
              <AgentFlagButton
                transactionId={null}
                address="general"
                label="Send note to progressor"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────────── */}
      <div className="hub-content-pad" style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── 2. Today's diary ──────────────────────────────────────────────────── */}
        {diaryItems.length > 0 && (
          <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>
                  Today&apos;s diary
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
                  Exchanges and completions scheduled for today
                </p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                color: "var(--agent-success)", background: "var(--agent-success-bg)",
                border: "1px solid var(--agent-success-border)",
                padding: "3px 10px", borderRadius: 99,
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
                  textDecoration: "none", transition: "filter 120ms", gap: 12,
                }}
                className="hover:brightness-[0.97]"
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

        {/* ── 3. Needs your attention ───────────────────────────────────────────── */}
        <div
          className="agent-glass-strong"
          style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}
        >
          {/* Section header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "0.5px solid var(--agent-border-subtle)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Clock size={15} color="var(--agent-text-muted)" />
              <div>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 500,
                  color: "var(--agent-text-primary)",
                }}>
                  Needs your attention
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
                  Files where something&apos;s stuck or due
                </p>
              </div>
            </div>
            {attentionItems.length > 0 && (
              <Link
                href="/agent/work-queue"
                style={{
                  fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)",
                  textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                Work queue
                <ArrowRight size={12} />
              </Link>
            )}
          </div>

          {/* Attention rows */}
          {attentionItems.length === 0 ? (
            <div style={{
              padding: "24px 20px", display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--agent-success)", flexShrink: 0,
              }} />
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                No reminders due right now. All clear.
              </p>
            </div>
          ) : (
            attentionItems.map((item, i) => {
              const s = URGENCY_STYLE[item.urgency];
              return (
                <Link
                  key={item.id}
                  href={`/agent/transactions/${item.transaction.id}?tab=reminders`}
                  style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    padding: "13px 20px 13px 17px",
                    borderLeft: `3px solid ${s.border}`,
                    background: s.bg,
                    borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                    textDecoration: "none", transition: "filter 120ms", gap: 12,
                  }}
                  className="hover:brightness-[0.97]"
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      margin: 0, fontSize: 12, fontWeight: 500,
                      color: "var(--agent-text-primary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {item.transaction.propertyAddress}
                    </p>
                    <p style={{
                      margin: "2px 0 0", fontSize: 11,
                      color: "var(--agent-text-secondary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {item.reminderName}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: s.color, flexShrink: 0,
                  }}>
                    {s.label}
                  </span>
                </Link>
              );
            })
          )}
        </div>

        {/* ── 3. Pipeline health + Momentum ─────────────────────────────────────── */}
        <div className="hub-grid-main" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>

          {/* Pipeline health card */}
          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div style={{
              display: "flex", alignItems: "flex-start",
              justifyContent: "space-between", marginBottom: 20,
            }}>
              <div>
                <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Pipeline health</p>
                <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: 0 }}>
                  Where your business sits right now
                </p>
              </div>
              <span
                title={
                  healthStatus === "on_track" ? "No overdue reminders — pipeline is progressing normally"
                  : healthStatus === "watch"   ? "Some reminders are overdue — a few files need attention"
                  : "Escalated reminders — immediate action required on one or more files"
                }
                style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "3px 10px", borderRadius: 99,
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
                  background: healthBadge.bg, color: healthBadge.color,
                  border: `1px solid ${healthBadge.border}`,
                  cursor: "help",
                }}>
                {healthBadge.label}
              </span>
            </div>

            <div className="hub-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
              {(
                [
                  {
                    value: pipelineStats.activeFiles.toLocaleString(),
                    label: "Active files",
                    color: "var(--agent-coral)",
                    href: "/agent/dashboard",
                    delta: pipelineStats.newThisMonth > 0 ? `+${pipelineStats.newThisMonth} this month` : null,
                  },
                  {
                    value: pipelineStats.exchangingSoon.toLocaleString(),
                    label: "Exchanging soon",
                    color: "var(--agent-success)",
                    href: "/agent/completions",
                    delta: null,
                  },
                  {
                    value: attentionFileCount.toLocaleString(),
                    label: "Need attention",
                    color: escalatedCount > 0 ? "var(--agent-danger)" : attentionFileCount > 0 ? "var(--agent-warning)" : "var(--agent-text-primary)",
                    href: attentionFileCount > 0 ? "/agent/work-queue" : null,
                    delta: null,
                  },
                  {
                    value: fmtCurrency(pipelineStats.pipelineValuePence),
                    label: "Pipeline value",
                    color: "var(--agent-text-primary)",
                    href: null,
                    delta: null,
                  },
                ] as { value: string; label: string; color: string; href: string | null; delta: string | null }[]
              ).map(({ value, label, color, href, delta }, i) => {
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
                        fontSize: 10, color: "var(--agent-success)",
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
                  transition: "background 120ms",
                };
                return href ? (
                  <Link
                    key={i}
                    href={href}
                    style={{ ...cellStyle, textDecoration: "none" }}
                    className="hover:bg-black/[0.04]"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={i} style={cellStyle}>{inner}</div>
                );
              })}
            </div>
          </div>

          {/* Momentum card */}
          <div className="agent-glass" style={{
            padding: "20px 24px", display: "flex", flexDirection: "column",
          }}>
            <div style={{ marginBottom: 16 }}>
              <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Momentum</p>
              <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: 0 }}>
                Exchanges this month vs last
              </p>
            </div>
            <div style={{
              flex: 1, display: "flex", alignItems: "center",
              justifyContent: "center", paddingBottom: 8,
            }}>
              <MomentumRing percent={momentum.percent} />
            </div>
            {momentum.percent !== null && (
              <div style={{
                borderTop: "0.5px solid var(--agent-border-subtle)",
                paddingTop: 12, marginTop: 4,
                display: "flex", flexDirection: "column", gap: 5,
              }}>
                {[
                  { label: "This month", count: momentum.thisMonth },
                  { label: "Last month", count: momentum.lastMonth },
                ].map(({ label, count }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                      {count} {count === 1 ? "exchange" : "exchanges"}
                    </span>
                  </div>
                ))}
                <p style={{
                  margin: "4px 0 0", fontSize: 11, fontWeight: 500,
                  color: momentum.percent >= 100 ? "var(--agent-success)" : "var(--agent-warning)",
                  textAlign: "right",
                }}>
                  {momentum.percent >= 100
                    ? momentum.percent === 100 ? "On pace with last month" : "Ahead of last month"
                    : "Below last month"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Exchange forecast + Service split ───────────────────────────────── */}
        <div className="hub-grid-half" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Exchange forecast */}
          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 16 }}>
              <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Exchange forecast</p>
              <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>
                When your sales expect to exchange
              </p>
            </div>

            {next30Days === 0 ? (
              <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: "0 0 16px", lineHeight: 1.6 }}>
                No exchange dates set in the next 30 days. Add expected exchange dates to active files to build your forecast.
              </p>
            ) : (
              <>
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
                  {next7Days === 1 ? "1 exchange due this week — files should be ready." : `${next7Days} exchanges due this week — make sure files are ready.`}
                </p>
              )}
            </div>
          </div>

          {/* Service split */}
          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 16 }}>
              <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Service split</p>
              <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>
                How your active files are being progressed
              </p>
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
                    { label: "Self-managed",    count: serviceSplit.selfManaged, color: "#FF8A65" },
                    { label: "With progressor", count: serviceSplit.outsourced,  color: "#C97D1A" },
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

            <div style={{
              borderTop: "0.5px solid var(--agent-border-subtle)",
              paddingTop: 12, marginTop: 12,
            }}>
              {serviceSplit.outsourced > 0 ? (
                <p style={{
                  margin: 0, fontSize: 12,
                  color: "var(--agent-text-secondary)", lineHeight: 1.6,
                }}>
                  <strong style={{ color: "var(--agent-text-primary)" }}>
                    {serviceSplit.outsourced} {serviceSplit.outsourced === 1 ? "file" : "files"}
                  </strong>{" "}
                  being progressed by our team
                  {savedHours > 0 && (
                    <> — saving you approximately{" "}
                      <strong style={{ color: "var(--agent-coral-deep)" }}>
                        {savedHours} agent hours
                      </strong>{" "}
                      this week
                    </>
                  )}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.6 }}>
                  All files are self-managed. Move files to Sales Progressor to free up your time.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── 5. Activity ribbon ─────────────────────────────────────────────────── */}
        {recentActivity && (
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,255,255,0.42)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "0.5px solid var(--agent-glass-border)",
            borderRadius: "var(--agent-radius-lg)",
            padding: "12px 20px", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                background: "var(--agent-coral)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Plus size={12} weight="bold" color="#fff" />
              </div>
              <div>
                <p style={{
                  margin: 0, fontSize: 12, fontWeight: 500,
                  color: "var(--agent-text-primary)",
                }}>
                  Last activity: {recentActivity.description}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
                  {timeAgo(recentActivity.at)} · {recentActivity.context}
                </p>
              </div>
            </div>
            <Link
              href={`/agent/transactions/${recentActivity.transactionId}`}
              style={{
                fontSize: 12, fontWeight: 600,
                color: "var(--agent-coral-deep)",
                textDecoration: "none",
                display: "flex", alignItems: "center", gap: 4,
                flexShrink: 0,
              }}
            >
              View file
              <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
