"use client";

// Files to review — the hub pointer banner turned into a full row-group
// drawer (Ellis, 2026-09-18). Same anatomy as the other hub cards:
// collapsible shade-hover header, flush rows with an accent bar, lift hover,
// Show all past 6, gone when empty. Shows DUE reviews only (today or
// earlier — matching the old pointer's count); upcoming + done stay on the
// To-Do page, reachable via the footer link.
//
// Two row kinds, mirroring lib/services/reviews.ts:
//   hold   — a file on hold whose return date has arrived. Primary
//            [Take off hold] (resume chooser), chevron: quick waits, pick a
//            date, hold indefinitely, and the full Withdraw flow (the
//            previously missing "move on" from this card's own subtitle).
//   manual — a hand-typed "check on this" review. Primary [Done], chevron:
//            snooze a week, pick a new date, open the file.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Eye, CaretDown, Check, CalendarPlus, Clock, Prohibit, ArrowSquareOut, CalendarBlank } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { RowActionMenu } from "@/components/hub/RowActionMenu";
import { ResumeFileModal } from "@/components/transaction/ResumeFileModal";
import { WithdrawFileModal } from "@/components/transaction/WithdrawFileModal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { reactivateFile, extendHoldAction, pauseClientEmails } from "@/app/actions/automation";
import { changeStatusAction } from "@/app/actions/transactions";
import { updateManualTaskAction } from "@/app/actions/manual-tasks";
import { DateField } from "@/components/ui/DateField";
import type { ReviewItem, ReviewOrigin } from "@/lib/services/reviews";

type Item = ReviewItem & { photoUrl: string | null };

const INITIAL_VISIBLE = 6;

const ORIGIN_PILL: Record<ReviewOrigin, { label: string; tone: "warning" | "info" | "brand" }> = {
  hold: { label: "On hold", tone: "warning" },
  chain_wait: { label: "Chain wait", tone: "info" },
  remarketing: { label: "Remarketing", tone: "brand" },
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dueBackLabel(d: Date | null): string {
  if (!d) return "No date set";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(d); due.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - due.getTime()) / 86400000);
  if (diff <= 0) return "Due back today";
  if (diff === 1) return "Due back yesterday";
  return `Due back ${diff} days ago`;
}

function plusDays(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
}

function todayInputStr(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function ReviewsDueCard({ items: initialItems, defaultCollapsed = false }: {
  items: Item[];
  // Hub clutter rule (Ellis, 2026-09-18): triage cards below the top two
  // start collapsed when more than one is on show.
  defaultCollapsed?: boolean;
}) {
  const { toast } = useAgentToast();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [resumeFor, setResumeFor] = useState<{ id: string; address: string } | null>(null);
  const [withdrawFor, setWithdrawFor] = useState<{ id: string; key: string } | null>(null);
  // Row switched into inline pick-a-date mode (hold extend or manual reschedule).
  const [dateFor, setDateFor] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState("");
  const [, startTransition] = useTransition();
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  if (items.length === 0) return null;

  const shown = showAll ? items : items.slice(0, INITIAL_VISIBLE);
  const hiddenCount = items.length - shown.length;

  function removeRow(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function run(key: string, fn: () => Promise<unknown>, okMsg: string, okDesc?: string) {
    setBusyKey(key);
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg, okDesc ? { description: okDesc } : undefined);
        removeRow(key);
      } catch {
        toast.error("Couldn't do that. Try again.");
      } finally {
        setBusyKey((cur) => (cur === key ? null : cur));
        setDateFor(null);
      }
    });
  }

  function doResume(transactionId: string, key: string, keepEmailsPaused: boolean) {
    setResumeFor(null);
    run(key, async () => {
      const result = await reactivateFile(transactionId);
      if (!result.ok) throw new Error("rejected");
      if (keepEmailsPaused) pauseClientEmails(transactionId).catch(() => {});
    }, "File active again", keepEmailsPaused ? "Client emails stay paused." : "Automation resumed.");
  }

  return (
    <>
    <GlassCard glassId="hub-attention" label="Hub · Files to review" defaultVariant="v27" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="agent-hover-ctl"
        style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, border: "none", borderBottom: collapsed ? "none" : "0.5px solid var(--agent-border-subtle)", cursor: "pointer", textAlign: "left" }}
      >
        <span aria-hidden style={{ color: "var(--agent-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Eye size={24} weight="bold" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="agent-card-title-emphasis" style={{ margin: 0 }}>Files to review</span>
            <span
              style={{
                fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, padding: "0 5px",
                borderRadius: 999, background: "rgba(var(--agent-info-rgb),0.12)",
                color: "var(--agent-info)", display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {items.length}
            </span>
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
            Return dates have arrived. Decide: wait on, resume, or move on.
          </span>
        </span>
        <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", alignItems: "center", transition: "transform 180ms ease", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", flexShrink: 0 }}>
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      {/* Collapsible body */}
      <div className={`agent-acc${collapsed ? "" : " open"}`}>
        <div className="agent-acc-in">
          <div ref={listRef}>
            {shown.map((item, i) => {
              const busy = busyKey === item.key;
              const isHold = item.kind === "hold";
              const pill = isHold ? ORIGIN_PILL[item.origin] : { label: "Review", tone: "info" as const };
              const headline = item.address ?? (item.kind === "manual" ? item.title : "");
              const sub = isHold
                ? `${dueBackLabel(item.reviewDate)}${item.reason ? ` · ${item.reason}` : ""}${item.placedByName ? ` · Placed by ${item.placedByName}` : ""}`
                : `${dueBackLabel(item.reviewDate)}${item.address ? ` · ${item.title}` : ""}${item.kind === "manual" && item.notes ? ` · ${item.notes}` : ""}`;
              return (
                <div
                  key={item.key}
                  style={{ borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}
                >
                  <div className="agent-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px" }}>
                    {item.transactionId ? (
                      <Link href={`/agent/transactions/${item.transactionId}`} className="hub-thumb-link" aria-label={`Open ${headline}`}>
                        <PropertyThumb photoUrl={item.photoUrl} />
                      </Link>
                    ) : (
                      <PropertyThumb photoUrl={item.photoUrl} />
                    )}
                    <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {item.transactionId ? (
                          <Link
                            href={`/agent/transactions/${item.transactionId}`}
                            className="hub-addr"
                            style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          >
                            {headline}
                          </Link>
                        ) : (
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {headline}
                          </p>
                        )}
                        <Pill glass tone={pill.tone} size="md" style={{ flexShrink: 0 }}>{pill.label}</Pill>
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sub}
                      </p>
                    </div>

                    {dateFor === item.key ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginLeft: "auto", flexShrink: 0 }}>
                        <DateField
                          value={dateDraft}
                          onChange={(e) => setDateDraft(e.target.value)}
                          min={todayInputStr()}
                          className="glass-input"
                          style={{ padding: "6px 10px", fontSize: 12 }}
                          wrapperStyle={{ display: "inline-block" }}
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            if (!dateDraft || dateDraft < todayInputStr()) { toast.error("Pick a future date"); return; }
                            const d = new Date(dateDraft); d.setHours(9, 0, 0, 0);
                            if (isHold) {
                              run(item.key, () => extendHoldAction(item.transactionId, d), "Hold extended", `Back on ${fmtDate(d)}.`);
                            } else if (item.kind === "manual") {
                              run(item.key, () => updateManualTaskAction(item.id, { dueDate: dateDraft }), "Review rescheduled", `Due ${fmtDate(d)}.`);
                            }
                          }}
                          disabled={busy || !dateDraft}
                          className="agent-btn agent-btn-xs agent-btn-primary"
                        >
                          Set date
                        </button>
                        <button onClick={() => setDateFor(null)} className="agent-link" style={{ fontSize: 11 }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "inline-flex", marginLeft: "auto", flexShrink: 0 }}>
                        {isHold ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setResumeFor({ id: item.transactionId, address: item.address })}
                            className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                          >
                            <Check size={13} weight="bold" />
                            Take off hold
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => item.kind === "manual" && run(item.key, () => updateManualTaskAction(item.id, { status: "done" }), "Review done")}
                            className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                          >
                            <Check size={13} weight="bold" />
                            Done
                          </button>
                        )}
                        <RowActionMenu
                          joined
                          disabled={busy}
                          items={
                            isHold
                              ? [
                                  {
                                    key: "wait-week",
                                    icon: <Clock size={16} weight="bold" />,
                                    title: "Wait another week",
                                    sub: "Extends the hold. Back here in 7 days.",
                                    onClick: () => run(item.key, () => extendHoldAction(item.transactionId, plusDays(7)), "Hold extended", `Back on ${fmtDate(plusDays(7))}.`),
                                  },
                                  {
                                    key: "wait-fortnight",
                                    icon: <CalendarBlank size={16} weight="bold" />,
                                    title: "Wait 2 more weeks",
                                    sub: "Extends the hold. Back here in 14 days.",
                                    onClick: () => run(item.key, () => extendHoldAction(item.transactionId, plusDays(14)), "Hold extended", `Back on ${fmtDate(plusDays(14))}.`),
                                  },
                                  {
                                    key: "pick-date",
                                    icon: <CalendarPlus size={16} weight="bold" />,
                                    title: "Pick a new date",
                                    sub: "Choose exactly when this comes back.",
                                    onClick: () => { setDateDraft(""); setDateFor(item.key); },
                                  },
                                  {
                                    key: "indefinite",
                                    icon: <Clock size={16} weight="bold" />,
                                    title: "Hold indefinitely",
                                    sub: "No return date. It won't resurface on its own.",
                                    onClick: () => run(item.key, () => extendHoldAction(item.transactionId, null), "Held indefinitely", "It won't resurface on its own."),
                                  },
                                  {
                                    key: "withdraw",
                                    icon: <Prohibit size={16} weight="bold" />,
                                    title: "Withdraw the file",
                                    sub: "The sale isn't happening. Record why and close it out.",
                                    danger: true,
                                    onClick: () => setWithdrawFor({ id: item.transactionId, key: item.key }),
                                  },
                                ]
                              : [
                                  {
                                    key: "snooze-week",
                                    icon: <Clock size={16} weight="bold" />,
                                    title: "Snooze for a week",
                                    sub: "Back on this list in 7 days.",
                                    onClick: () => item.kind === "manual" && run(item.key, () => {
                                      const d = plusDays(7);
                                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                                      const dd = String(d.getDate()).padStart(2, "0");
                                      return updateManualTaskAction(item.id, { dueDate: `${d.getFullYear()}-${mm}-${dd}` });
                                    }, "Snoozed", "Back in a week."),
                                  },
                                  {
                                    key: "pick-date",
                                    icon: <CalendarPlus size={16} weight="bold" />,
                                    title: "Pick a new date",
                                    sub: "Choose exactly when to look again.",
                                    onClick: () => { setDateDraft(""); setDateFor(item.key); },
                                  },
                                  ...(item.transactionId
                                    ? [{
                                        key: "open",
                                        icon: <ArrowSquareOut size={16} weight="bold" />,
                                        title: "Open the file",
                                        sub: "Review it in full on the property file.",
                                        href: `/agent/transactions/${item.transactionId}`,
                                      }]
                                    : []),
                                ]
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="agent-link"
                style={{ width: "100%", padding: "10px 20px", fontSize: 12, fontWeight: 600, textAlign: "center", background: "transparent", border: "none", borderTop: "0.5px solid var(--agent-border-subtle)", cursor: "pointer" }}
              >
                Show all ({items.length})
              </button>
            )}
            {/* Upcoming + completed reviews stay on the To-Do page. */}
            <Link
              href="/agent/to-do#section-reviews"
              className="agent-link"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "10px 20px", fontSize: 12, fontWeight: 600, borderTop: "0.5px solid var(--agent-border-subtle)", textDecoration: "none" }}
            >
              All reviews on To-Do
            </Link>
          </div>
        </div>
      </div>
    </GlassCard>

    {resumeFor && (
      <ResumeFileModal
        address={resumeFor.address}
        onCancel={() => setResumeFor(null)}
        onResume={(keepPaused) => {
          const key = items.find((i) => i.kind === "hold" && i.transactionId === resumeFor.id)?.key;
          if (key) doResume(resumeFor.id, key, keepPaused);
          else setResumeFor(null);
        }}
      />
    )}
    {withdrawFor && (
      <WithdrawFileModal
        inChain={false}
        onCancel={() => setWithdrawFor(null)}
        onConfirm={(reason, finalReason) => {
          const target = withdrawFor;
          setWithdrawFor(null);
          run(target.key, () => changeStatusAction(target.id, "withdrawn", finalReason, null, reason), "Withdrawn", "The file is closed out.");
        }}
      />
    )}
    </>
  );
}
