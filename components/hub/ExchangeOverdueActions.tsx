"use client";

// The chevron dropdown on a Hub "Exchange date passed" row, so the agent can deal
// with it in place instead of hunting on the file. Matches the enquiries split-
// menu feel. The menu is portalled to <body> and positioned from the button's
// rect (clamped to the viewport) so it's never clipped by the card or lost off
// screen. Three ways out:
//   - Set a new date  → the file's revise flow (has the "spoken to both parties"
//     safety gate), so we don't rebuild that here.
//   - Recalibrate     → re-run the estimate from today (one tap).
//   - Snooze          → hush it for a few days without a fake date (one tap).

import { useState, useRef, useLayoutEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CaretDown, CalendarPlus, ArrowsClockwise, Clock } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { recalibrateExchangeDateAction, snoozeExchangeReminderAction } from "@/app/actions/transactions";

const MENU_W = 260;

export function ExchangeOverdueActions({ transactionId }: { transactionId: string }) {
  const { toast } = useAgentToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // Right-align to the button, clamped so it never runs off either edge.
    const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
    // Open downward; flip above if there isn't room.
    const estH = 190;
    const top = r.bottom + estH > window.innerHeight - 8 ? Math.max(8, r.top - estH - 4) : r.bottom + 4;
    setPos({ top, left });
  }, [open]);

  const run = (
    action: () => Promise<{ ok: boolean }>,
    okMsg: string,
    okDesc: string,
    failMsg: string,
  ) => {
    setOpen(false);
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) throw new Error("rejected");
        toast.success(okMsg, { description: okDesc });
      } catch {
        toast.error(failMsg);
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <div style={{ display: "inline-flex", flexShrink: 0, marginLeft: "auto" }}>
      <button
        ref={btnRef}
        type="button"
        disabled={busy}
        aria-label="Deal with this"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
      >
        {busy ? "Working…" : "Deal with it"}
        <CaretDown size={13} weight="bold" style={{ transition: "transform 160ms", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && pos && typeof window !== "undefined" && createPortal(
        <>
          {/* click-away backdrop */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1400 }} />
          <div
            role="menu"
            style={{
              position: "fixed", top: pos.top, left: pos.left, width: MENU_W, zIndex: 1401,
              background: "var(--agent-menu-surface, #ffffff)",
              border: "0.5px solid var(--agent-border-default)",
              borderRadius: 12, boxShadow: "0 12px 32px rgba(15,23,42,0.16)", padding: 6,
              display: "flex", flexDirection: "column", gap: 2,
            }}
          >
            <Link
              href={`/agent/transactions/${transactionId}`}
              onClick={() => setOpen(false)}
              className="agent-hover-row"
              style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "8px 10px", borderRadius: 8, textDecoration: "none" }}
            >
              <CalendarPlus size={16} weight="bold" style={{ color: "var(--agent-coral-deep)", marginTop: 1, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Set a new date</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.35 }}>Once you&apos;ve spoken to both parties.</span>
              </span>
            </Link>

            <MenuAction
              icon={<ArrowsClockwise size={16} weight="bold" />}
              title="Recalibrate estimate"
              sub="Re-estimate from today based on what's left."
              onClick={() => run(() => recalibrateExchangeDateAction(transactionId), "Estimate recalibrated", "New expected date set from today.", "Couldn't recalibrate")}
            />
            <MenuAction
              icon={<Clock size={16} weight="bold" />}
              title="Snooze a few days"
              sub="Hush it while you're chasing. No date set."
              onClick={() => run(() => snoozeExchangeReminderAction(transactionId), "Snoozed", "We'll bring it back in a few days.", "Couldn't snooze")}
            />
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

function MenuAction({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="agent-hover-row"
      style={{ display: "flex", gap: 9, alignItems: "flex-start", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, background: "none", border: "none", cursor: "pointer" }}
    >
      <span style={{ color: "var(--agent-coral-deep)", marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{title}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.35 }}>{sub}</span>
      </span>
    </button>
  );
}
