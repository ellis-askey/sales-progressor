"use client";

// Merged Next-action + Reminders card (2026-08-12). The hero is the single
// most-urgent thing (top reminder, or a milestone fallback); the remaining
// active reminders list underneath as "Up next" — so the #1 reminder is shown
// ONCE, not duplicated across two cards. When there's no hero but reminders
// exist (e.g. all snoozed) it falls back to a plain reminders card.

import { useState, type ReactNode } from "react";
import { NextActionCard, type NextActionIcon } from "./NextActionCard";
import { useTabContext } from "./TabContext";
import { completeTaskAction, snoozeTaskAction } from "@/app/actions/tasks";
import { SnoozeMenu, type SnoozeChoice } from "@/components/reminders/SnoozeMenu";
import { ConfirmMilestoneDateModal, milestoneNeedsDatePrompt } from "@/components/milestones/ConfirmMilestoneDateModal";
import { daysUntil, formatDate } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { LinkArrow } from "@/components/ui/LinkArrow";

type MiniReminder = { id: string; ruleName: string; nextDueDate: Date | string; snoozedUntil?: Date | string | null };

export type NextActionInput = {
  transactionId: string;
  pathname: string;
  reminder: {
    ruleName: string;
    topTaskId: string | null;
    nextDueDate: Date | string;
    // The milestone the top task confirms, when it targets one. Drives the
    // exchange/completion date prompt on "Mark complete".
    targetMilestoneCode?: string | null;
    // Set when the hero is a snoozed reminder (nothing live) — the status line
    // reads "Snoozed until <date>" instead of a due label.
    snoozedUntil?: Date | string | null;
  } | null;
  fallbackMilestone: { name: string; code: string } | null;
  otherReminders: MiniReminder[];
  totalActive: number;
};

function relativeDueLabel(due: Date | string): { label: string; tone: "coral" | "warn" | "muted" } {
  const days = daysUntil(due);
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, tone: "warn" };
  if (days === 0) return { label: "Due today", tone: "coral" };
  if (days === 1) return { label: "Due tomorrow", tone: "coral" };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "coral" };
  return { label: `Due ${new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, tone: "muted" };
}

// Which state glyph leads the hero (Ellis's 2026-11-08 picks).
function iconForReminder(r: { nextDueDate: Date | string; snoozedUntil?: Date | string | null }): NextActionIcon {
  if (r.snoozedUntil && new Date(r.snoozedUntil) > new Date()) return "snoozed";
  const days = daysUntil(r.nextDueDate);
  if (days < 0) return "overdue";
  if (days <= 7) return "due";
  return "upcoming";
}

function ReminderRow({ r, onNavigate }: { r: MiniReminder; onNavigate: () => void }) {
  const isSnoozed = r.snoozedUntil && new Date(r.snoozedUntil) > new Date();
  const days = isSnoozed ? 0 : daysUntil(r.nextDueDate);
  const isOverdue = !isSnoozed && days < 0;
  const isToday = !isSnoozed && days === 0;
  const dotColor = isOverdue ? "#ef4444" : isToday ? "var(--agent-coral)" : "rgba(15,23,42,0.18)";
  const statusText = isSnoozed
    ? `Snoozed until ${formatDate(r.snoozedUntil!)}`
    : isOverdue ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue` : isToday ? "Due today" : `From ${formatDate(r.nextDueDate)}`;
  return (
    <button
      type="button"
      onClick={onNavigate}
      className="agent-hover-row"
      aria-label={`${r.ruleName} — ${statusText}. Open reminders.`}
      // Extra horizontal padding so the hover highlight breathes past the text,
      // pulled back with a matching negative margin so the text stays aligned.
      style={{
        boxSizing: "border-box", width: "calc(100% + 20px)", marginLeft: -10,
        padding: "7px 10px", borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: "none", border: "none", font: "inherit", textAlign: "left", cursor: "pointer",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: dotColor }} />
        <span style={{ fontSize: 12, color: isSnoozed ? "var(--agent-text-muted)" : "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ruleName}</span>
      </span>
      <span style={{ fontSize: 10, color: isOverdue ? "#ef4444" : "var(--agent-text-muted)", flexShrink: 0, fontWeight: isOverdue ? 600 : 400 }}>{statusText}</span>
    </button>
  );
}

function UpNext({ reminders, totalActive, onViewAll }: { reminders: MiniReminder[]; totalActive: number; onViewAll: () => void }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <span className="agent-eyebrow" style={{ margin: 0 }}>Up next</span>
        <button onClick={onViewAll} className="agent-link" style={{ fontSize: 11 }}>
          View all{totalActive > 0 ? ` (${totalActive})` : ""} <LinkArrow />
        </button>
      </div>
      {/* Rows are clickable → the reminders tab (where snoozed + active live). */}
      {reminders.map((r) => <ReminderRow key={r.id} r={r} onNavigate={onViewAll} />)}
    </div>
  );
}

export function NextActionCardConsumer({ transactionId, pathname, reminder, fallbackMilestone, otherReminders, totalActive }: NextActionInput) {
  const { setActiveTab } = useTabContext();
  // Phase 2 (2026-09-17): pending is ack-scoped - it clears when the
  // server acknowledges the write, not when the page refetch lands.
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Exchange/completion date prompt — open when the top reminder targets a
  // VM19/PM26/VM20/PM27 step, so the real event date is captured first.
  const [datePrompt, setDatePrompt] = useState<{ taskId: string; code: string | null } | null>(null);
  // Optimistic snooze advance: the just-snoozed task id, kept locally so the
  // hero flips to the next reminder immediately (before the server refetch
  // lands). `heroOut` drives the fade-out that plays just before the flip.
  const [snoozedId, setSnoozedId] = useState<string | null>(null);
  const [heroOut, setHeroOut] = useState(false);

  const goReminders = () => setActiveTab("reminders");

  async function runComplete(taskId: string, eventDate?: string) {
    if (pending) return; // double-submit guard
    setError(null);
    setPending(true);
    try {
      const result = await completeTaskAction(taskId, pathname, eventDate);
      if ("blocked" in result && result.blocked) {
        const names = result.missing.map((m) => m.name.replace(/\.$/, "")).join(", ");
        setError(`Confirm ${names} first.`);
      }
      // Phase 4 (2026-09-18, PERF-03): no client refresh - completeTaskAction
      // revalidates the pathname it is given (this page).
    } catch {
      setError("Couldn't mark this complete. Try again.");
    } finally {
      setPending(false);
    }
  }
  async function handleSnooze(taskId: string, choice: SnoozeChoice) {
    if (pending) return;
    setError(null);
    setHeroOut(true);          // hero fades + lifts out
    setPending(true);
    // Let the exit play, then flip to the next reminder (fades in) and shift
    // the Up-next list up. The server revalidation replaces the optimistic
    // promotion with the real next hero moments later.
    await new Promise((r) => setTimeout(r, 170));
    setSnoozedId(taskId);
    setHeroOut(false);
    try {
      await snoozeTaskAction(taskId, choice, pathname);
    } catch {
      setSnoozedId(null); // revert the optimistic advance so the hero returns
      setError("Couldn't snooze this. Try again.");
    } finally {
      setPending(false);
    }
  }

  const list = otherReminders.length > 0
    ? <UpNext reminders={otherReminders} totalActive={totalActive} onViewAll={goReminders} />
    : undefined;

  // Case 1 — reminder-driven hero
  if (reminder) {
    // Optimistic advance: if the top reminder was just snoozed, promote the
    // first up-next item into the hero slot while the server refetch lands.
    const heroSnoozed = !!reminder.topTaskId && snoozedId === reminder.topTaskId;
    const ghost = heroSnoozed ? otherReminders[0] ?? null : null;
    const restList = heroSnoozed ? otherReminders.slice(1) : otherReminders;
    const belowList = restList.length > 0
      ? <UpNext reminders={restList} totalActive={Math.max(0, totalActive - (heroSnoozed ? 1 : 0))} onViewAll={goReminders} />
      : undefined;

    // The hero's identity — drives the keyed enter animation when it changes.
    const heroKey = heroSnoozed ? (ghost?.id ?? "none") : (reminder.topTaskId ?? reminder.ruleName);

    let card: ReactNode = null;
    if (!heroSnoozed) {
      // A snoozed hero (nothing live) reads "Snoozed until <date>", muted;
      // otherwise the normal relative due label.
      const due = reminder.snoozedUntil && new Date(reminder.snoozedUntil) > new Date()
        ? { label: `Snoozed until ${formatDate(reminder.snoozedUntil)}`, tone: "muted" as const }
        : relativeDueLabel(reminder.nextDueDate);
      const body = fallbackMilestone ? `Waiting on: ${fallbackMilestone.name.replace(/\.$/, "")}.` : "Follow up when you're ready.";
      const taskId = reminder.topTaskId;
      const onMarkComplete = taskId
        ? () => {
            // Exchange/completion steps capture the real event date first.
            if (milestoneNeedsDatePrompt(reminder.targetMilestoneCode)) {
              setDatePrompt({ taskId, code: reminder.targetMilestoneCode ?? null });
              return;
            }
            runComplete(taskId);
          }
        : undefined;
      card = (
        <NextActionCard
          title={reminder.ruleName}
          description={body}
          dueLabel={pending ? "Snoozing…" : due.label}
          dueTone={due.tone}
          icon={iconForReminder(reminder)}
          primaryLabel="Mark complete"
          onPrimary={onMarkComplete}
          secondaryLabel="View reminders"
          onSecondary={goReminders}
          snoozeSlot={taskId ? <SnoozeMenu variant="icon" subtextVerb="Comes back" disabled={pending} onConfirm={(c) => handleSnooze(taskId, c)} /> : undefined}
          belowActions={belowList}
        />
      );
    } else if (ghost) {
      // Promoted next reminder — actions light up once the server refetch
      // replaces this with the real hero (which carries its task id).
      const due = relativeDueLabel(ghost.nextDueDate);
      card = (
        <NextActionCard
          title={ghost.ruleName}
          description="Follow up when you're ready."
          dueLabel={due.label}
          dueTone={due.tone}
          icon={iconForReminder(ghost)}
          secondaryLabel="View reminders"
          onSecondary={goReminders}
          snoozeSlot={<SnoozeMenu variant="icon" subtextVerb="Comes back" disabled onConfirm={() => {}} />}
          belowActions={belowList}
        />
      );
    }

    return (
      <div>
        {card && (
          <div key={heroKey} className={`na-hero${heroOut ? " na-hero-out" : ""}`}>
            {card}
          </div>
        )}
        {!card && (
          <p style={{ margin: "4px 4px", fontSize: 13, color: "var(--agent-text-muted)" }}>
            Snoozed. Nothing else waiting right now.
          </p>
        )}
        {error && <p style={{ margin: "8px 4px 0", fontSize: 12, color: "var(--agent-warning)", lineHeight: 1.4 }}>{error}</p>}
        <ConfirmMilestoneDateModal
          open={!!datePrompt}
          milestoneCode={datePrompt?.code ?? null}
          onConfirm={(eventDate) => {
            const p = datePrompt;
            setDatePrompt(null);
            if (p) runComplete(p.taskId, eventDate);
          }}
          onClose={() => setDatePrompt(null)}
        />
        <style>{`
          .na-hero{animation:naHeroIn 220ms cubic-bezier(0.22,1,0.36,1)}
          .na-hero-out{animation:none;transition:opacity 160ms ease,transform 160ms ease;opacity:0;transform:translateY(-6px)}
          @keyframes naHeroIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        `}</style>
      </div>
    );
  }

  // Case 2 — milestone-driven hero (no active reminder)
  if (fallbackMilestone) {
    return (
      <NextActionCard
        title={fallbackMilestone.name}
        description="Next step waiting to be confirmed."
        dueLabel="No reminder yet"
        dueTone="muted"
        primaryLabel="View steps"
        onPrimary={() => setActiveTab("milestones")}
        belowActions={list}
      />
    );
  }

  // Case 3 — no hero, but reminders exist (e.g. all snoozed): plain list card.
  void transactionId;
  if (otherReminders.length > 0) {
    return (
      <GlassCard glassId="overview-reminders" label="Overview · Reminders" defaultVariant="v05" className="overflow-hidden" style={{ borderRadius: 12 }}>
        <div className="agent-card-hdr">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 className="agent-card-title">Reminders</h3>
            {totalActive > 0 && <span className="agent-badge">{totalActive}</span>}
          </div>
          <button onClick={goReminders} className="agent-link" style={{ fontSize: 11 }}>View all <LinkArrow /></button>
        </div>
        <div style={{ padding: "6px 16px 12px" }}>
          {otherReminders.map((r) => <ReminderRow key={r.id} r={r} onNavigate={goReminders} />)}
        </div>
      </GlassCard>
    );
  }

  return null;
}
