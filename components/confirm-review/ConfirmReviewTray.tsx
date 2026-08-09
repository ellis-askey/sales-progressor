"use client";

// Floating review tray — appears bottom-right of the property file
// page whenever milestone confirmations are queued (waiting to send
// to the client). Live countdown; tap to open the review modal.
//
// Ellis's brief (2026-08-09):
//   Agent confirms N steps. Instead of a modal firing per-confirm
//   (friction) OR the emails just going 5 min later (blind), a small
//   pill shows what's queued + how long until it sends + a way to
//   review + edit + skip per recipient.
//
// Polls getPendingConfirmQueueForFile every 15s while mounted so we
// pick up new queued rows as the agent confirms more steps. Countdown
// ticks locally between polls.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, X } from "@phosphor-icons/react/dist/ssr";
import {
  getPendingConfirmQueueForFile,
  type PendingQueueItem,
} from "@/app/actions/confirm-review-queue";
import { ConfirmReviewModal } from "./ConfirmReviewModal";

type Props = {
  transactionId: string;
};

const POLL_MS = 15_000;

export function ConfirmReviewTray({ transactionId }: Props) {
  const [items, setItems] = useState<PendingQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [modalOpen, setModalOpen] = useState(false);
  const [hidden, setHidden] = useState(false); // user X'd the pill for this batch

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPendingConfirmQueueForFile(transactionId);
      if (res.ok) setItems(res.items);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  // Poll every 15s while mounted so we see new confirms as they queue.
  useEffect(() => {
    void load();
    const t = window.setInterval(() => { void load(); }, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  // Local 1s tick for the live countdown between polls.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Un-hide when the queue changes (new confirms while hidden).
  useEffect(() => {
    setHidden(false);
  }, [items.length]);

  // Earliest scheduledFor across the queue drives the countdown label.
  const earliest = useMemo(() => {
    if (items.length === 0) return null;
    return Math.min(...items.map((i) => new Date(i.scheduledFor).getTime()));
  }, [items]);
  const msLeft = earliest !== null ? Math.max(0, earliest - now) : 0;
  const countdownLabel = formatCountdown(msLeft);

  const shouldShow = items.length > 0 && !hidden;

  return (
    <>
      {/* Floating pill */}
      <div
        aria-live="polite"
        style={{
          // Sits above the topbar (101), overlays (100), agent modals (1000),
          // dropdowns (1500), AND transient toasts (2000). Ellis's rule:
          // when a step confirm fires a toast at the same time, the review
          // pill must remain visible — bumped from zIndex:30 on 2026-08-09.
          position: "fixed",
          bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
          right: 20,
          zIndex: 2100,
          transform: shouldShow ? "translateY(0)" : "translateY(24px)",
          opacity: shouldShow ? 1 : 0,
          pointerEvents: shouldShow ? "auto" : "none",
          transition: "opacity 220ms ease, transform 260ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px 10px 16px",
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.94)",
            border: "0.5px solid rgba(15, 23, 42, 0.10)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06)",
            maxWidth: 360,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#f59e0b",
              flexShrink: 0,
            }}
          />
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", lineHeight: 1.2 }}>
              {items.length} client update{items.length === 1 ? "" : "s"} queued
            </span>
            {msLeft > 0 && (
              <span style={{ fontSize: 10, color: "#64748b", lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>
                Sending in {countdownLabel}
              </span>
            )}
            {msLeft <= 0 && (
              <span style={{ fontSize: 10, color: "#64748b", lineHeight: 1.3 }}>
                Sending shortly
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              borderRadius: 999,
              border: "none",
              background: "#5b8cff",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Eye size={12} weight="regular" />
            Review
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="Hide"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 999,
              border: "none",
              background: "transparent",
              color: "#94a3b8",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      </div>

      <ConfirmReviewModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        transactionId={transactionId}
        items={items}
        loading={loading}
        onChange={() => { void load(); }}
      />
    </>
  );
}

function formatCountdown(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total <= 0) return "0s";
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
