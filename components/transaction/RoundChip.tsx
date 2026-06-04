"use client";

// Phase 1 commit 8 — round chip in PropertyHero.
//
// Visibility (locked spec):
//   - HIDDEN when roundNumber === 1 && status !== "withdrawn".
//   - VISIBLE otherwise (R2+ active, OR R1 withdrawn, OR R2+ withdrawn).
//
// Copy (terminology sweep, Ellis voice-pass 2026-06-04 — "round" is
// banned as a user-facing noun; "withdrew"/"closed" → "fell through"):
//   - Active (sale > 1): "Sale N with {buyerName}"
//                        (hover hint: "The previous buyer fell through;
//                         view that sale.")
//   - Withdrawn:         "Sale N with {buyerName} · fell through {date}"
//
// Click opens the ArchivedRoundDrawer for the most recent archived round.

import { useState } from "react";
import { ArchivedRoundDrawer } from "./ArchivedRoundDrawer";

type Props = {
  transactionId: string;
  status: string;
  activeRoundNumber: number | null;
  activeBuyerName: string | null;
  buyerRounds: Array<{ id: string; roundNumber: number; status: string; archivedAt: Date | null }>;
};

function fmtShortDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function RoundChip({ transactionId, status, activeRoundNumber, activeBuyerName, buyerRounds }: Props) {
  const [open, setOpen] = useState(false);

  // Visibility gate.
  const isWithdrawn = status === "withdrawn";
  const isHidden = activeRoundNumber === 1 && !isWithdrawn;
  if (isHidden) return null;
  if (!activeRoundNumber) return null;

  // Archived rounds — most recent first. The chip opens the most
  // recent one by default; if there are several, the drawer's header
  // exposes a switcher.
  const archived = buyerRounds
    .filter((r) => r.status === "withdrawn")
    .sort((a, b) => b.roundNumber - a.roundNumber);
  const mostRecentArchived = archived[0] ?? null;

  // Compose chip text. Terminology sweep 2026-06-04: "round" is banned
  // as a user-facing noun ("sale" instead); "withdrew"/"closed" become
  // "fell through" for the fall-through event; em dash → middle dot.
  // Schema field is still `roundNumber` (internal).
  const buyerLabel = activeBuyerName ?? "no buyer yet";
  const chipLabel = isWithdrawn && mostRecentArchived
    ? `Sale ${mostRecentArchived.roundNumber} with ${buyerLabel} · fell through ${fmtShortDate(mostRecentArchived.archivedAt)}`
    : `Sale ${activeRoundNumber} with ${buyerLabel}`;

  // Long-form text used in the drawer header — voice-passed.
  const hoverHint = isWithdrawn
    ? `View ${mostRecentArchived ? `Sale ${mostRecentArchived.roundNumber}` : "this sale"}'s record.`
    : "The previous buyer fell through; view that sale.";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={hoverHint}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.01em",
          background: isWithdrawn ? "rgba(199, 62, 62, 0.10)" : "rgba(45, 52, 64, 0.06)",
          color: isWithdrawn ? "var(--agent-danger, #C73E3E)" : "var(--agent-text-secondary, #4b5563)",
          border: "0.5px solid rgba(0,0,0,0.08)",
          cursor: archived.length > 0 ? "pointer" : "default",
          opacity: archived.length > 0 ? 1 : 0.7,
        }}
        aria-label={hoverHint}
        disabled={archived.length === 0}
      >
        {chipLabel}
      </button>
      {archived.length > 0 && (
        <ArchivedRoundDrawer
          open={open}
          transactionId={transactionId}
          archivedRounds={archived.map((r) => ({ id: r.id, roundNumber: r.roundNumber }))}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
