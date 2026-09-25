"use client";

// Client wrapper for Today's diary. Holds the "snooze for today" dismissals — a
// view-only, per-day flag in localStorage (keyed to today's date, pruned on
// load) so a snoozed row stays hidden through refreshes today and naturally
// clears tomorrow. It touches nothing server-side: a slipped exchange still
// surfaces on the "Exchange date passed" card once its date is in the past. The
// count pill reflects what's visible, so it drops as you snooze.

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/glass/GlassCard";
import { DiaryEventRow } from "@/components/hub/DiaryEventRow";
import type { DiaryItem } from "@/lib/services/hub";

type Item = DiaryItem & { photoUrl: string | null };

const STORE = "hubDiaryDismissed";
function todayKey(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
}

const DIARY_STYLES = `
  /* The whole row lifts on hover (like the other hub row groups), but keeps its
     purposely-coloured background rather than washing to a neutral tint. */
  .diary-row { container-type: inline-size; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px 10px 13px; border-left: 3px solid var(--diary-accent); background: var(--diary-bg); transition: background-color .15s ease, box-shadow .15s ease; }
  /* Confirm-button label swap: full label by default, one-word once the row is
     narrow enough that the address would otherwise lose room to truncation. */
  .diary-cta-short { display: none; }
  @container (max-width: 480px) {
    .diary-cta-full { display: none; }
    .diary-cta-short { display: inline; }
  }
  .diary-row:hover { background: var(--diary-bg-hover); box-shadow: var(--agent-hover-lift); position: relative; z-index: 1; }
  .diary-idlink { text-decoration: none; }
  .diary-addr-l1 { font-size: 12.5px; font-weight: 600; color: var(--agent-text-primary); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color .14s ease; }
  .diary-addr-town { font-size: 11px; color: var(--agent-text-secondary); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color .14s ease; }
  .diary-row:hover .diary-addr-l1, .diary-row:hover .diary-addr-town { color: var(--agent-coral-deep); }
  /* Buttons are solid white here only — the row background is coloured, so the
     transparent ghost buttons would otherwise disappear into it. */
  .diary-row .agent-btn-ghost-bordered { background: var(--agent-surface-elevated); }
  /* Match the standard ghost-button hover used across the other hub groups
     (Chase button, row chevrons): deepen the border + glyph to coral-darker and
     lay the neutral hover shade over the opaque white base, so these darken like
     the rest instead of only swapping the border colour. */
  .diary-row .agent-btn-ghost-bordered:hover:not(:disabled) {
    background: linear-gradient(var(--agent-hover-shade), var(--agent-hover-shade)), var(--agent-surface-elevated);
    border-color: var(--agent-coral-darker);
    color: var(--agent-coral-darker);
  }
`;

export function DiaryCard({ items }: { items: Item[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Hydrate today's dismissals on mount, pruning any older days so the store
  // never grows. (Read here, not in useState, to avoid an SSR/CSR mismatch.)
  useEffect(() => {
    const key = todayKey();
    let map: Record<string, string[]> = {};
    try { map = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { map = {}; }
    const todays = Array.isArray(map[key]) ? map[key] : [];
    try { localStorage.setItem(STORE, JSON.stringify({ [key]: todays })); } catch { /* ignore */ }
    if (todays.length) setDismissed(new Set(todays));
  }, []);

  function snooze(transactionId: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(transactionId);
      try { localStorage.setItem(STORE, JSON.stringify({ [todayKey()]: [...next] })); } catch { /* ignore */ }
      return next;
    });
  }

  const visible = items.filter((i) => !dismissed.has(i.transactionId));
  if (visible.length === 0) return null;

  // Pill colour keyed to the day's mix: coral if any exchange, else green.
  const hasExchange = visible.some((i) => i.type === "exchange");
  const rgb = hasExchange ? "var(--agent-coral-rgb)" : "var(--agent-success-rgb)";
  const deep = hasExchange ? "var(--agent-coral-deep)" : "var(--agent-success)";

  return (
    <GlassCard glassId="hub-diary" label="Hub · Today's diary" defaultVariant="v05" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      <style>{DIARY_STYLES}</style>
      <div className="agent-card-hdr" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <p className="agent-card-title-emphasis">Today&apos;s diary</p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)", textWrap: "balance" }}>Exchanges and completions scheduled for today</p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", flexShrink: 0, whiteSpace: "nowrap",
          color: deep, padding: "3px 11px", borderRadius: 999,
          background: `linear-gradient(160deg, rgba(${rgb}, 0.20), rgba(${rgb}, 0.07))`,
          border: `0.5px solid rgba(${rgb}, 0.22)`,
          boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 3px rgba(${rgb}, 0.14)`,
        }}>
          {visible.length} {visible.length === 1 ? "event" : "events"} today
        </span>
      </div>
      {visible.map((item, i) => (
        <DiaryEventRow key={item.transactionId} item={item} isFirst={i === 0} onSnooze={snooze} />
      ))}
    </GlassCard>
  );
}
