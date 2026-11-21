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
import type { CSSProperties } from "react";
import Link from "next/link";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Eye, Check, CalendarPlus, Clock, Prohibit, ArrowSquareOut, CalendarBlank } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { HubCard } from "@/components/hub/HubCard";
import { HubRow } from "@/components/hub/HubRow";
import { HubSplitButton } from "@/components/hub/HubSplitButton";
import { buttonClasses } from "@/components/arc/button/button";
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

// First line + town/postcode (last two comma parts). Inline per the grandfathered
// per-component pattern shared across the hub cards.
function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

// Split a "X · Y" context line into halves for the mobile stack; no separator
// stays a single part.
function splitOnDot(s: string): string[] {
  const i = s.indexOf(" · ");
  return i === -1 ? [s] : [s.slice(0, i), s.slice(i + 3)];
}

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
    <HubCard
      glassId="hub-attention"
      label="Hub · Files to review"
      icon={<Eye size={24} weight="regular" />}
      iconColor="var(--agent-info)"
      title={<><span style={{ color: "var(--agent-info)", fontWeight: 700 }}>{items.length}</span> file{items.length !== 1 ? "s" : ""} to review</>}
      subtitle="Return dates have arrived. Decide: wait on, resume, or move on."
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      bodyRef={listRef}
    >
            {shown.map((item, i) => {
              const busy = busyKey === item.key;
              const isHold = item.kind === "hold";
              const pill = isHold ? ORIGIN_PILL[item.origin] : { label: "Review", tone: "info" as const };
              // Toned status word on its own line, matching BookingsToConfirmCard
              // (critique #295 — the inline pill is gone across the hub cards).
              const pillColor = pill.tone === "warning" ? "var(--agent-warning)"
                : pill.tone === "brand" ? "var(--agent-coral-deep)"
                : "var(--agent-info)";
              const headline = item.address ?? (item.kind === "manual" ? item.title : "");
              // Only split real addresses — a manual task's title isn't comma-structured.
              const addr = item.address ? splitAddress(item.address) : null;
              const sub = isHold
                ? `${dueBackLabel(item.reviewDate)}${item.reason ? ` · ${item.reason}` : ""}${item.placedByName ? ` · Placed by ${item.placedByName}` : ""}`
                : `${dueBackLabel(item.reviewDate)}${item.address ? ` · ${item.title}` : ""}${item.kind === "manual" && item.notes ? ` · ${item.notes}` : ""}`;
              return (
                <HubRow
                  key={item.key}
                  accent={pillColor}
                  separated={i > 0}
                  thumb={
                    item.transactionId ? (
                      <Link href={`/agent/transactions/${item.transactionId}`} className="hub-thumb-link" aria-label={`Open ${headline}`}>
                        <PropertyThumb photoUrl={item.photoUrl} />
                      </Link>
                    ) : (
                      <PropertyThumb photoUrl={item.photoUrl} />
                    )
                  }
                  tail={
                    <>
                    <span className="hub-r-meta-m" style={{ fontSize: 11, color: "var(--agent-text-secondary)" }}>
                      {splitOnDot(sub).map((p, k) => <span key={k}>{p}</span>)}
                    </span>
                    {dateFor === item.key ? (
                      <div className="hub-r-actions" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
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
                          className={buttonClasses({ variant: "primary", size: "xs" })}
                          style={{ ["--foreground"]: "#FF6B4A", ["--background"]: "#ffffff" } as CSSProperties}
                        >
                          Set date
                        </button>
                        <button onClick={() => setDateFor(null)} className={buttonClasses({ variant: "ghost", size: "xs" })}>Cancel</button>
                      </div>
                    ) : (
                      <HubSplitButton
                        className="hub-r-actions"
                        disabled={busy}
                        label={<><Check size={13} weight="bold" />{isHold ? "Take off hold" : "Done"}</>}
                        onClick={isHold
                          ? () => setResumeFor({ id: item.transactionId, address: item.address })
                          : () => { if (item.kind === "manual") run(item.key, () => updateManualTaskAction(item.id, { status: "done" }), "Review done"); }}
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
                    )}
                    </>
                  }
                >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {item.transactionId ? (
                          <Link
                            href={`/agent/transactions/${item.transactionId}`}
                            className="hub-addr"
                            style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", minWidth: 0 }}
                          >
                            {addr ? (<>
                              <span className="hub-addr-full">{headline}</span>
                              <span className="hub-addr-line">{addr.line}</span>
                              {addr.location && <span className="hub-addr-loc">{addr.location}</span>}
                            </>) : headline}
                          </Link>
                        ) : (
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {headline}
                          </p>
                        )}
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 700, color: pillColor, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {pill.label}
                      </p>
                      <p className="hub-r-meta-d" style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sub}
                      </p>
                </HubRow>
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
    </HubCard>

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
