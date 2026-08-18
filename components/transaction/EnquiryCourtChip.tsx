"use client";

// Hero "whose court" chip (enquiries rework). Sits in the property-file hero
// badge row and signals whose solicitor holds the enquiries ball.
//
//  - Reply loop (interactive): a two-way slider. Clicking the other side hands
//    the ball over (flips the court + restarts the chase clock). One tap, no
//    note required. The fuller three-intent controls live in the Overview
//    tracker panel.
//  - Pre-raise (read-only): a static pill showing the ball with the buyer's
//    solicitor while we chase them to raise enquiries.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scales } from "@phosphor-icons/react/dist/ssr";
import { logEnquiryMovementAction } from "@/app/actions/enquiries";
import type { EnquiryHeroState } from "@/lib/enquiries/tracker";

type Court = "seller_solicitor" | "buyer_solicitor";

const SHORT: Record<Court, string> = {
  seller_solicitor: "Seller’s sol",
  buyer_solicitor: "Buyer’s sol",
};
const FULL: Record<Court, string> = {
  seller_solicitor: "the seller’s solicitor",
  buyer_solicitor: "the buyer’s solicitor",
};

const TONE = {
  chasing: {
    fill: "rgba(var(--agent-coral-rgb), 0.16)",
    text: "var(--agent-coral-deep)",
    ring: "rgba(var(--agent-coral-rgb), 0.30)",
    dot: "var(--agent-coral)",
  },
  stalled: { fill: "rgba(245, 158, 11, 0.16)", text: "#b45309", ring: "rgba(245, 158, 11, 0.35)", dot: "#f59e0b" },
  snoozed: { fill: "rgba(100, 116, 139, 0.14)", text: "#475569", ring: "rgba(100, 116, 139, 0.30)", dot: "#94a3b8" },
} as const;

const fmt = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

export function EnquiryCourtChip({
  transactionId,
  data,
}: {
  transactionId: string;
  data: EnquiryHeroState;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<Court | null>(null);
  const side: Court = optimistic ?? data.currentlyWith;
  const tone = TONE[data.status];

  // Clear the optimistic override once the refreshed server state agrees.
  useEffect(() => {
    if (optimistic && data.currentlyWith === optimistic) setOptimistic(null);
  }, [data.currentlyWith, optimistic]);

  const caption =
    data.status === "stalled"
      ? "Stalled"
      : data.status === "snoozed"
        ? "Snoozed"
        : data.phase === "raising"
          ? "Raising"
          : data.nextChaseAt
            ? `Nudge ${fmt(data.nextChaseAt)}`
            : "Chasing";

  function slideTo(target: Court) {
    if (target === side || pending) return;
    setOptimistic(target);
    start(async () => {
      await logEnquiryMovementAction({ transactionId, mode: "handover", flipsCourtTo: target });
      router.refresh();
    });
  }

  // Read-only pre-raise leg: a single static pill.
  if (!data.interactive) {
    return (
      <span
        title={`Enquiries with ${FULL[side]} - ${caption.toLowerCase()}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 26,
          padding: "0 10px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          color: tone.text,
          background: tone.fill,
          border: `1px solid ${tone.ring}`,
          whiteSpace: "nowrap",
        }}
      >
        <Scales size={13} weight="fill" aria-hidden />
        {SHORT[side]}
        <span style={{ opacity: 0.6, fontWeight: 500 }}>{"·"} {caption}</span>
      </span>
    );
  }

  // Live slider (reply loop).
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
      title={`Enquiries with ${FULL[side]}. Tap a side to hand the ball over.`}
    >
      <span
        role="group"
        aria-label="Whose court the enquiries are in"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: 2,
          borderRadius: 999,
          background: "var(--agent-surface-overlay)",
          border: "1px solid var(--agent-border-default)",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {(["seller_solicitor", "buyer_solicitor"] as Court[]).map((c) => {
          const active = side === c;
          return (
            <button
              key={c}
              type="button"
              disabled={pending}
              onClick={() => slideTo(c)}
              aria-pressed={active}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 22,
                padding: "0 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: pending ? "default" : "pointer",
                border: "none",
                whiteSpace: "nowrap",
                color: active ? tone.text : "var(--agent-text-muted)",
                background: active ? tone.fill : "transparent",
                boxShadow: active ? `inset 0 0 0 1px ${tone.ring}` : "none",
                transition: "background 160ms, color 160ms",
              }}
            >
              {active && (
                <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: tone.dot }} />
              )}
              {SHORT[c]}
            </button>
          );
        })}
      </span>
      <span style={{ fontSize: 11, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>{caption}</span>
    </span>
  );
}
