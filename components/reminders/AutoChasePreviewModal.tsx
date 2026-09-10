"use client";

// "View" preview for an autopilot row: shows the real email the pending
// auto-chase will send (composed by the same functions the crons use), in a
// sandboxed frame that grows to the email's true size. Labelled a preview — the
// live send is composed fresh at send time, the warm subject variant rotates,
// and agency copy edits aren't applied here.
//
// Responsive presentation (not the shared Modal primitive, which centres and
// has no bottom-sheet): a centred card on desktop, an animated bottom sheet on
// narrow screens. Self-contained portal so it doesn't touch the shared modal
// chrome other surfaces are mid-edit on.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { EmailPreviewFrame } from "@/components/email/EmailPreviewFrame";
import { getAutoChasePreview, type AutoChasePreview } from "@/app/actions/auto-chase-preview";

export function AutoChasePreviewModal({
  open,
  onClose,
  logId,
  pipeline,
  transactionId,
  sendLabel,
}: {
  open: boolean;
  onClose: () => void;
  logId: string;
  pipeline: "client" | "solicitor";
  transactionId: string;
  sendLabel: string; // e.g. "tomorrow at 10:30am"
}) {
  const { theme, isNight } = usePortalTheme();
  const [state, setState] = useState<{ status: "loading" } | { status: "done"; data: AutoChasePreview }>({ status: "loading" });
  // Bumped by "Try again" to re-run the load. The preview builds from pure,
  // synchronous composers (no AI, no network) behind a couple of quick DB
  // reads, so it should never actually hang — but a cold/slow server-action
  // invocation can stall. We bound the wait so a stall surfaces as a clear,
  // retryable failure instead of an infinite "Building preview…".
  const [attempt, setAttempt] = useState(0);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setState({ status: "loading" });
    const timeout = setTimeout(() => {
      if (live) setState({ status: "done", data: { ok: false, error: "This is taking longer than expected. Try again." } });
    }, 12_000);
    getAutoChasePreview(logId, pipeline)
      .then((data) => { if (live) { clearTimeout(timeout); setState({ status: "done", data }); } })
      .catch(() => { if (live) { clearTimeout(timeout); setState({ status: "done", data: { ok: false, error: "Couldn't build the preview." } }); } });
    return () => { live = false; clearTimeout(timeout); };
  }, [open, logId, pipeline, attempt]);

  // Escape to close + body scroll lock + focus restore, mirroring the Modal
  // primitive (we can't use it here because we need the bottom-sheet layout).
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { e.preventDefault(); onClose(); } }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof window === "undefined") return null;

  const label = { fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em" };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Auto-chase email preview"
      className="agent-backdrop-overlay nv2-night acp-backdrop"
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 210, display: "flex" }}
    >
      <div className="acp-card agent-modal-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ flexShrink: 0, padding: "20px 22px 12px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, paddingRight: 28 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>
              What we&apos;ll send
            </h2>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-success)", background: "var(--agent-success-bg)", border: "0.5px solid var(--agent-success-border-strong)", borderRadius: 20, padding: "2px 9px" }}>
              Preview
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)" }}>
            Auto-chase {sendLabel}. We compose it fresh when it sends, so the exact wording can vary slightly.
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", color: "var(--agent-text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,23,42,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 22px" }}>
          {state.status === "loading" && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--agent-text-muted)", fontSize: 13 }}>
              Building preview…
            </div>
          )}

          {state.status === "done" && !state.data.ok && (
            <div style={{ padding: "32px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <span style={{ color: "var(--agent-text-muted)", fontSize: 13 }}>{state.data.error}</span>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="agent-btn agent-btn-secondary"
                style={{ fontSize: 12.5, padding: "7px 14px" }}
              >
                Try again
              </button>
            </div>
          )}

          {state.status === "done" && state.data.ok && (
            <div style={{ padding: "4px 0 8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 10, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-subtle)", marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ ...label, width: 52, flexShrink: 0, paddingTop: 1 }}>To</span>
                  <span style={{ fontSize: 13, color: "var(--agent-text-primary)", fontWeight: 600 }}>
                    {state.data.recipientName} <span style={{ fontWeight: 500, color: "var(--agent-text-muted)" }}>· {state.data.recipientRole}</span>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ ...label, width: 52, flexShrink: 0, paddingTop: 1 }}>Subject</span>
                  <span style={{ fontSize: 13, color: "var(--agent-text-primary)" }}>{state.data.subject}</span>
                </div>
              </div>

              {/* The real email HTML, sandboxed, grown to its true height so the
                  whole email shows and this body scrolls it as one surface. */}
              <div style={{ border: "0.5px solid var(--agent-border-subtle)", borderRadius: 10, overflow: "hidden", background: "#fff", marginBottom: 4 }}>
                <EmailPreviewFrame html={state.data.html} title="Auto-chase email preview" minHeight={240} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px 18px", gap: 12, borderTop: "0.5px solid var(--agent-border-subtle)" }}>
          <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>Want to change it? Open the file to chase manually or adjust.</span>
          <Link href={`/agent/transactions/${transactionId}`} className="agent-link" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
            Open in file <LinkArrow />
          </Link>
        </div>
      </div>

      <style>{`
        .acp-backdrop { align-items: center; justify-content: center; padding: 88px 16px 24px; }
        .acp-card {
          background: ${isNight ? "#161d2e" : "#ffffff"};
          width: 100%;
          max-width: 640px;
          max-height: calc(100dvh - 120px);
          border-radius: 16px;
          border-top: 2px solid var(--agent-coral-deep, #FF6B4A);
          box-shadow: 0 24px 64px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        @media (max-width: 640px) {
          .acp-backdrop { align-items: flex-end; justify-content: stretch; padding: 0; }
          .acp-card {
            max-width: none;
            max-height: 90dvh;
            border-radius: 18px 18px 0 0;
            border-top: none;
            animation: acp-sheet-up 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
        }
        @keyframes acp-sheet-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
