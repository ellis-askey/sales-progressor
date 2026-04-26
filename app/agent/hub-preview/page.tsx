import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import {
  getHubPipelineStats, getHubAttentionItems, getHubMomentum,
  getHubWeeklyForecast, getHubServiceSplit, getHubRecentActivity,
} from "@/lib/services/hub";
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
  upcoming: {
    border: "var(--agent-border-subtle)",
    bg:     "rgba(255,255,255,0.20)",
    color:  "var(--agent-text-muted)",
    label:  "Upcoming",
  },
  snoozed: {
    border: "var(--agent-border-subtle)",
    bg:     "rgba(255,255,255,0.12)",
    color:  "var(--agent-text-disabled)",
    label:  "Snoozed",
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

  const [pipelineStats, attentionItems, momentum, weeklyForecast, serviceSplit, recentActivity] =
    await Promise.all([
      getHubPipelineStats(vis),
      getHubAttentionItems(vis),
      getHubMomentum(vis),
      getHubWeeklyForecast(vis),
      getHubServiceSplit(vis),
      getHubRecentActivity(vis),
    ]);

  // Derived values
  const escalatedCount    = attentionItems.filter((i) => i.urgency === "escalated").length;
  const overdueCount      = attentionItems.filter((i) => i.urgency === "overdue").length;
  const attentionFileCount = new Set(attentionItems.map((i) => i.transaction.id)).size;
  const healthStatus      = escalatedCount > 0 ? "action" : overdueCount > 0 ? "watch" : "on_track";
  const healthBadge    = HEALTH_BADGE[healthStatus];
  const top5Items      = attentionItems.slice(0, 5);
  const next7Days      = weeklyForecast[0]?.count ?? 0;
  const next30Days     = weeklyForecast.reduce((s, w) => s + w.count, 0);
  const savedHours     = Math.round(serviceSplit.outsourced * 2.5);
  const updatedAt      = new Date();
  const greeting       = getGreeting(session.user.name ?? "there");
  const isEmpty        = pipelineStats.activeFiles === 0 && attentionItems.length === 0;

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "70vh",
        padding: "64px 32px", textAlign: "center",
      }}>
        <p className="agent-eyebrow" style={{ marginBottom: 16 }}>Hub</p>
        <h2 style={{
          fontSize: "var(--agent-text-h2)", fontWeight: 600,
          color: "var(--agent-text-primary)", marginBottom: 10,
          letterSpacing: "var(--agent-tracking-tight)",
        }}>
          Welcome. Your pipeline starts here.
        </h2>
        <p style={{
          fontSize: 14, color: "var(--agent-text-secondary)",
          marginBottom: 32, lineHeight: 1.65, maxWidth: 400,
        }}>
          Add your first transaction to start seeing your pipeline, attention
          items, and exchange forecast.
        </p>
        <Link
          href="/agent/transactions/new"
          className="agent-btn agent-btn-primary agent-btn-md"
          style={{ textDecoration: "none" }}
        >
          <Plus size={16} weight="bold" />
          Add a sale
        </Link>
      </div>
    );
  }

  // ── Full hub ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* ── 1. Header ─────────────────────────────────────────────────────────── */}
      <div
        className="agent-glass-strong"
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
          {/* Eyebrow + refresh */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p className="agent-eyebrow">Hub · Preview</p>
            <RefreshButton updatedLabel={`Updated ${timeAgo(updatedAt)}`} />
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
                New transaction
              </Link>
              <AgentFlagButton
                transactionId={null}
                address="general"
                label="Flag to progressor"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────────── */}
      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── 2. Pipeline health + Momentum ─────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>

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
              <span style={{
                display: "inline-flex", alignItems: "center",
                padding: "3px 10px", borderRadius: 99,
                fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
                background: healthBadge.bg, color: healthBadge.color,
                border: `1px solid ${healthBadge.border}`,
              }}>
                {healthBadge.label}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
              {[
                {
                  value: pipelineStats.activeFiles.toLocaleString(),
                  label: "Active files",
                  color: "var(--agent-coral)",
                },
                {
                  value: pipelineStats.exchangingSoon.toLocaleString(),
                  label: "Exchanging soon",
                  color: "var(--agent-success)",
                },
                {
                  value: attentionFileCount.toLocaleString(),
                  label: "Need attention",
                  color: escalatedCount > 0 ? "var(--agent-danger)" : attentionFileCount > 0 ? "var(--agent-warning)" : "var(--agent-text-primary)",
                },
                {
                  value: fmtCurrency(pipelineStats.pipelineValuePence),
                  label: "Pipeline value",
                  color: "var(--agent-text-primary)",
                },
              ].map(({ value, label, color }, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", padding: "6px 12px", gap: 5,
                    borderLeft: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined,
                  }}
                >
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
                </div>
              ))}
            </div>
          </div>

          {/* Momentum card */}
          <div className="agent-glass" style={{
            padding: "20px 24px", display: "flex", flexDirection: "column",
          }}>
            <p className="agent-eyebrow" style={{ marginBottom: 16 }}>Momentum</p>
            <div style={{
              flex: 1, display: "flex", alignItems: "center",
              justifyContent: "center", paddingBottom: 8,
            }}>
              <MomentumRing percent={momentum.percent} />
            </div>
          </div>
        </div>

        {/* ── 3. Needs your attention ─────────────────────────────────────────────── */}
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
                View all ({attentionItems.length})
                <ArrowRight size={12} />
              </Link>
            )}
          </div>

          {/* Attention rows — driven by active reminder logs */}
          {top5Items.length === 0 ? (
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
            top5Items.map((item, i) => {
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

        {/* ── 4. Exchange forecast + Service split ───────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Exchange forecast */}
          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 16 }}>
              <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Exchange forecast</p>
              <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>
                Next 30 days
              </p>
            </div>

            {next30Days === 0 ? (
              <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: "0 0 16px" }}>
                No exchanges forecast in the next 30 days yet.
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
                        fontSize: 10, color: "var(--agent-text-muted)",
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
                { label: "Next 7 days", count: next7Days },
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
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                    {count} {count === 1 ? "exchange" : "exchanges"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Service split */}
          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 16 }}>
              <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Service split</p>
              <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>
                Active files
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
                    { label: "Self-progressed", count: serviceSplit.selfManaged, color: "#FF8A65" },
                    { label: "With us",         count: serviceSplit.outsourced,  color: "#C97D1A" },
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

            {serviceSplit.outsourced > 0 && (
              <div style={{
                borderTop: "0.5px solid var(--agent-border-subtle)",
                paddingTop: 12, marginTop: 12,
              }}>
                <p style={{
                  margin: 0, fontSize: 12,
                  color: "var(--agent-text-secondary)", lineHeight: 1.5,
                }}>
                  <strong style={{ color: "var(--agent-text-primary)" }}>
                    {serviceSplit.outsourced}
                  </strong>{" "}
                  {serviceSplit.outsourced === 1 ? "file" : "files"} with our team
                  {savedHours > 0 && (
                    <>
                      {" · "}
                      <strong style={{ color: "var(--agent-coral-deep)" }}>
                        ~{savedHours} hrs
                      </strong>{" "}
                      saved this week
                    </>
                  )}
                </p>
              </div>
            )}
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
