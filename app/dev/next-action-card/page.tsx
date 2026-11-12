"use client";

// /dev/next-action-card — a byte-for-byte harness for the Overview "Next action"
// card (critique #280). Renders the REAL <NextActionCard> (and the real <UpNext>
// queue) with mock props, and cycles every display that actually ships: the
// chase states, the fallbacks, and the one new type — a confirmation you owe
// (survey/valuation bookings in your hold pile), which outranks any chase.
// Everything else we discussed (problems, tasks, chain nudges, reviews, setup)
// was deliberately NOT built. Flip light/dark to check both themes.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NextActionCard, type NextActionCardProps } from "@/components/transaction/NextActionCard";
import { UpNext, type MiniReminder } from "@/components/transaction/NextActionCardConsumer";
import { SnoozeMenu } from "@/components/reminders/SnoozeMenu";

// Shared mocks ---------------------------------------------------------------
const snooze = <SnoozeMenu variant="icon" subtextVerb="Comes back" onConfirm={() => {}} />;

const upNextReminders: MiniReminder[] = [
  { id: "r1", ruleName: "Chase: Return property forms", nextDueDate: new Date(Date.now() - 2 * 86400000) },
  { id: "r2", ruleName: "Chase: Draft contract pack issued", nextDueDate: new Date() },
  { id: "r3", ruleName: "Chase: Mortgage offer received", nextDueDate: new Date(Date.now() + 3 * 86400000) },
];
const upNextSlot = <UpNext reminders={upNextReminders} totalActive={5} onViewAll={() => {}} />;

const noop = () => {};

// States ---------------------------------------------------------------------
type State = {
  key: string;
  group: string;
  label: string;
  note?: string;
  // null render = the card doesn't show at all (the Consumer returns null).
  render: () => ReactNode;
};

function card(p: NextActionCardProps) {
  return <NextActionCard {...p} />;
}

const STATES: State[] = [
  // ── Chases (what ships today) ──────────────────────────────────────────
  { key: "overdue", group: "Chases (today)", label: "Overdue chase",
    note: "Top reminder past its due date.",
    render: () => card({ title: "Searches received", description: "", dueLabel: "2 days overdue", dueTone: "warn", icon: "overdue", primaryLabel: "Mark complete", onPrimary: noop, secondaryLabel: "View reminders", onSecondary: noop, snoozeSlot: snooze }) },
  { key: "due", group: "Chases (today)", label: "Due today",
    render: () => card({ title: "Return property forms", description: "", dueLabel: "Due today", dueTone: "coral", icon: "due", primaryLabel: "Mark complete", onPrimary: noop, secondaryLabel: "View reminders", onSecondary: noop, snoozeSlot: snooze }) },
  { key: "upcoming", group: "Chases (today)", label: "Upcoming",
    render: () => card({ title: "Draft contract pack issued", description: "", dueLabel: "Due in 4 days", dueTone: "coral", icon: "upcoming", primaryLabel: "Mark complete", onPrimary: noop, secondaryLabel: "View reminders", onSecondary: noop, snoozeSlot: snooze }) },
  { key: "snoozed", group: "Chases (today)", label: "Snoozed hero",
    note: "Nothing live — the top reminder is snoozed.",
    render: () => card({ title: "Enquiries raised", description: "", dueLabel: "Snoozed until 18 Nov", dueTone: "muted", icon: "snoozed", secondaryLabel: "View reminders", onSecondary: noop, snoozeSlot: snooze }) },
  { key: "escalated", group: "Chases (today)", label: "Escalated",
    note: "Chased repeatedly with no reply — siren glyph.",
    render: () => card({ title: "Management pack requested", description: "", dueLabel: "5 days overdue", dueTone: "warn", icon: "escalated", primaryLabel: "Mark complete", onPrimary: noop, secondaryLabel: "View reminders", onSecondary: noop, snoozeSlot: snooze }) },
  { key: "chainwait", group: "Chases (today)", label: "Waiting on chain",
    render: () => card({ title: "Buyer's mortgage offer", description: "", dueLabel: "Waiting on the chain", dueTone: "muted", icon: "chain", secondaryLabel: "View reminders", onSecondary: noop, snoozeSlot: snooze }) },
  { key: "queue", group: "Chases (today)", label: "Hero + Up-next queue",
    note: "Two-pane layout: hero left, the real Up-next list right.",
    render: () => card({ title: "Searches received", description: "", dueLabel: "2 days overdue", dueTone: "warn", icon: "overdue", primaryLabel: "Mark complete", onPrimary: noop, secondaryLabel: "View reminders", onSecondary: noop, snoozeSlot: snooze, belowActions: upNextSlot }) },

  // ── Fallbacks ──────────────────────────────────────────────────────────
  { key: "milestone", group: "Fallbacks", label: "Milestone fallback",
    note: "No reminder yet — points at the next pending step.",
    render: () => card({ title: "Return property forms", description: "Next step waiting to be confirmed.", dueLabel: "No reminder yet", dueTone: "muted", primaryLabel: "View steps", onPrimary: noop }) },
  { key: "empty", group: "Fallbacks", label: "Nothing actionable",
    note: "The card returns null — nothing renders on the Overview.",
    render: () => (
      <div style={{ padding: "20px 18px", border: "1px dashed var(--agent-border-default)", borderRadius: 14, color: "var(--agent-text-muted)", fontSize: 13, textAlign: "center" }}>
        Card not rendered — nothing to do on this file.
      </div>
    ) },

  // ── The one real new type: a confirmation you owe (critique #280) ───────
  // Everything else (problems, tasks, chain nudges, reviews, setup/intro) was
  // deliberately NOT added — see the plan. Only chases + confirmations ship.
  { key: "confirm", group: "Confirmation you owe", label: "Survey to confirm",
    note: "A survey the client booked on their portal, sitting in your hold pile. It outranks any chase, so it's the hero. The real Confirm button opens a date + keys panel.",
    render: () => card({ title: "Confirm the survey booking", description: "A client logged a survey on their portal. Check the date and access, then confirm and we'll let everyone know.", dueLabel: "Booked for 18 Nov", dueTone: "coral", icon: "confirm", primaryLabel: "Confirm", onPrimary: noop, secondaryLabel: "View reminders", onSecondary: noop }) },
  { key: "confirm-valuation", group: "Confirmation you owe", label: "Valuation to confirm",
    note: "The lender-valuation variant (PM6).",
    render: () => card({ title: "Confirm the valuation booking", description: "A client logged a lender valuation on their portal. Check the date and access, then confirm and we'll let everyone know.", dueLabel: "Booked for 20 Nov", dueTone: "coral", icon: "confirm", primaryLabel: "Confirm", onPrimary: noop, secondaryLabel: "View reminders", onSecondary: noop }) },
  { key: "confirm-queue", group: "Confirmation you owe", label: "Confirmation + chases below",
    note: "When you owe a confirmation AND have chases, the confirmation is the hero and the chases drop into Up next.",
    render: () => card({ title: "Confirm the survey booking", description: "A client logged a survey on their portal. Check the date and access, then confirm and we'll let everyone know.", dueLabel: "Booked for 18 Nov", dueTone: "coral", icon: "confirm", primaryLabel: "Confirm", onPrimary: noop, secondaryLabel: "View reminders", onSecondary: noop, belowActions: upNextSlot }) },
];

export default function NextActionCardDevPage() {
  const [idx, setIdx] = useState(0);
  const [dark, setDark] = useState(false);

  // Flip the agent theme on <html> so the card renders in light or dark.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") setIdx((i) => (i + 1) % STATES.length);
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") setIdx((i) => (i - 1 + STATES.length) % STATES.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, { state: State; i: number }[]>();
    STATES.forEach((s, i) => {
      if (!m.has(s.group)) m.set(s.group, []);
      m.get(s.group)!.push({ state: s, i });
    });
    return [...m.entries()];
  }, []);

  const current = STATES[idx];

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "260px 1fr" }}>
      {/* Sidebar — grouped state list */}
      <aside style={{ borderRight: "0.5px solid var(--agent-border-default)", padding: "20px 14px", overflowY: "auto", height: "100vh", position: "sticky", top: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h1 style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>Next action card</h1>
          <button
            onClick={() => setDark((v) => !v)}
            style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 7, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", color: "var(--agent-text-secondary)", cursor: "pointer" }}
          >
            {dark ? "Dark" : "Light"}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
          The real card, every state. ↑/↓ to cycle.
        </p>
        {groups.map(([group, items]) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--agent-text-muted)", margin: "0 0 6px" }}>{group}</p>
            {items.map(({ state, i }) => (
              <button
                key={state.key}
                onClick={() => setIdx(i)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "6px 9px", borderRadius: 7,
                  fontSize: 12.5, fontWeight: i === idx ? 700 : 500, cursor: "pointer", border: "none", marginBottom: 1,
                  background: i === idx ? "var(--agent-coral)" : "transparent",
                  color: i === idx ? "#fff" : "var(--agent-text-secondary)",
                }}
              >
                {state.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* Preview */}
      <main style={{ padding: "48px 40px", overflowY: "auto", height: "100vh" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>{current.label}</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setIdx((i) => (i - 1 + STATES.length) % STATES.length)} style={navBtn}>← Prev</button>
              <button onClick={() => setIdx((i) => (i + 1) % STATES.length)} style={navBtn}>Next →</button>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--agent-text-muted)", margin: "0 0 2px" }}>{current.group} · {idx + 1}/{STATES.length}</p>
          {current.note && <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", margin: "0 0 20px", lineHeight: 1.5 }}>{current.note}</p>}

          {/* The real card, at the real Overview column width. */}
          <div style={{ marginTop: 20 }}>{current.render()}</div>
        </div>
      </main>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 8,
  border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)",
  color: "var(--agent-text-primary)", cursor: "pointer",
};
