"use client";

// components/transaction/AiSummaryButton.tsx
//
// Internal-only (ellis) prototype. Button in the property-file header that
// opens a modal with an Anthropic-generated summary of the whole file.
// Visibility gate lives at the call site; component itself doesn't check
// — by the time it renders, the gate has passed.
//
// Modal pattern mirrors components/transaction/StatusControl.tsx — useState
// + createPortal + usePortalTheme so the agent CSS variables resolve.

import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { Sparkle, X } from "@phosphor-icons/react/dist/ssr";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { generateTransactionSummaryAction, type SummaryJson } from "@/app/actions/transaction-summary";

type Props = { transactionId: string };

export function AiSummaryButton({ transactionId }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<SummaryJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await generateTransactionSummaryAction(transactionId);
      if (res.ok) setSummary(res.summary);
      else setError(res.error);
    });
  }

  function handleOpen() {
    setOpen(true);
    if (!summary && !isPending) run();
  }

  function handleClose() {
    setOpen(false);
  }

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="AI summary of this file"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 999,
          fontSize: 12, fontWeight: 500,
          color: "var(--agent-text-primary, #111827)",
          background: "var(--agent-surface-glass, rgba(255,255,255,0.55))",
          border: "0.5px solid var(--agent-border-default, rgba(0,0,0,0.12))",
          cursor: "pointer",
          transition: "background 120ms, transform 120ms",
        }}
        className="hover:bg-black/[0.04]"
      >
        <Sparkle size={13} weight="fill" style={{ color: "#FF6B4A" }} />
        AI summary
      </button>

      {open && createPortal(
        <div
          data-theme={theme}
          data-night={isNight ? "" : undefined}
          className="nv2-night fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 1500 }}
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl w-full max-w-xl"
            style={{
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
              maxHeight: "85vh", display: "flex", flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <div className="flex items-center gap-2">
                <Sparkle size={16} weight="fill" style={{ color: "#FF6B4A" }} />
                <p className="text-sm font-semibold text-slate-900">AI summary</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 8, background: "transparent",
                  border: "none", cursor: "pointer", color: "var(--agent-text-muted, #6b7280)",
                }}
                className="hover:bg-black/[0.05]"
              >
                <X size={14} weight="bold" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto" style={{ flex: 1 }}>
              {isPending && !summary && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <div
                    style={{
                      width: 20, height: 20, borderRadius: "50%",
                      border: "2px solid rgba(0,0,0,0.12)",
                      borderTopColor: "#FF6B4A",
                      animation: "agent-spin 700ms linear infinite",
                      marginBottom: 12,
                    }}
                  />
                  <p className="text-xs">Generating summary…</p>
                </div>
              )}

              {error && !isPending && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-red-600 mb-3">{error}</p>
                  <button
                    type="button"
                    onClick={run}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-white"
                    style={{ background: "#FF6B4A" }}
                  >
                    Try again
                  </button>
                </div>
              )}

              {summary && (
                <div className="space-y-4">
                  <Section title="Status" emphasis>
                    {summary.status}
                  </Section>

                  {summary.keyDates.length > 0 && (
                    <Section title="Key dates">
                      <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
                        {summary.keyDates.map((k, i) => (
                          <DateRow key={i} label={k.label} date={k.date} note={k.note} />
                        ))}
                      </div>
                    </Section>
                  )}

                  <Section title="Where it's stuck">
                    {summary.whereItsStuck}
                  </Section>

                  <Section title="Recent activity">
                    {summary.recentActivity}
                  </Section>

                  <Section title="Watch out for">
                    {summary.watchOutFor}
                  </Section>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <p className="text-[10.5px] text-slate-400">
                AI generated · Haiku 4.5 · ~$0.005 per request
              </p>
              <button
                type="button"
                onClick={run}
                disabled={isPending}
                className="px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50"
                style={{
                  background: "var(--agent-surface-glass, rgba(0,0,0,0.04))",
                  color: "var(--agent-text-primary, #111827)",
                  border: "0.5px solid var(--agent-border-default, rgba(0,0,0,0.12))",
                  cursor: isPending ? "default" : "pointer",
                }}
              >
                {isPending ? "Working…" : "Regenerate"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Section({ title, children, emphasis }: { title: string; children: React.ReactNode; emphasis?: boolean }) {
  return (
    <div>
      <p
        style={{
          fontSize: 10, fontWeight: 600, color: "#6b7280",
          textTransform: "uppercase", letterSpacing: 0.7,
          marginBottom: 6,
        }}
      >
        {title}
      </p>
      <div
        style={{
          fontSize: emphasis ? 14 : 13,
          lineHeight: 1.55,
          color: "#1f2937",
          fontWeight: emphasis ? 500 : 400,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DateRow({ label, date, note }: { label: string; date: string; note?: string }) {
  return (
    <>
      <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 12, color: "#1f2937" }}>
        <span style={{ fontWeight: 500 }}>{formatDateMaybe(date)}</span>
        {note ? <span style={{ color: "#6b7280" }}> — {note}</span> : null}
      </span>
    </>
  );
}

function formatDateMaybe(s: string): string {
  // If it looks like an ISO date, format as "DD MMM YYYY"; otherwise return as-is.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  return s;
}
