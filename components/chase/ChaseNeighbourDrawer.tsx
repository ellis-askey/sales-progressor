"use client";

// Chase the neighbour agent above/below in the chain.
//
// A focused, lean drawer — deliberately NOT the ChaseDrawer (which is built around
// ChaseTask + Contact recipients for client/solicitor chases and must stay
// untouched). It reuses the AI phrasing engine via the neighbour-chase actions,
// but the recipient is a chain stub agent and there is no task. Email only.
//
// Spec: docs/active/chain-agent-chase/00-spec.md Part C.

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Sparkle, PaperPlaneTilt, CircleNotch } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useOverlayChrome } from "@/lib/agent/use-overlay-chrome";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import {
  draftNeighbourChaseAction,
  sendNeighbourChaseAction,
} from "@/app/actions/neighbour-chase";
import type { NeighbourChaseDirection } from "@/lib/services/neighbour-chase";

type Tone = "Friendly" | "Professional" | "Polite Yet Firm" | "Chase Up" | "Urgent" | "Final Reminder";
const TONES: Tone[] = ["Friendly", "Professional", "Polite Yet Firm", "Chase Up", "Urgent", "Final Reminder"];
const TONE_DISPLAY: Record<Tone, string> = {
  "Friendly": "Friendly",
  "Professional": "Professional",
  "Polite Yet Firm": "Polite yet firm",
  "Chase Up": "Chase up",
  "Urgent": "Urgent",
  "Final Reminder": "Final reminder",
};

type Props = {
  transactionId: string;
  direction: NeighbourChaseDirection;
  // Optional, for an immediate header while the draft loads.
  neighbourName?: string | null;
  neighbourAddress?: string | null;
  onClose: () => void;
};

function reasonMessage(reason: string, direction: NeighbourChaseDirection): string {
  const where = direction === "onward" ? "above" : "below";
  switch (reason) {
    case "no_chain":
      return "This sale isn't in a chain yet, so there's no neighbour to chase.";
    case "no_neighbour":
      return `There's no sale ${where} this one in the chain yet. Add it on the Chain tab first.`;
    case "no_email":
      return `We don't have an email for the agent ${where} in the chain. Add their email on the Chain tab, then you can chase them.`;
    case "claimed":
      return "That agent is already on the platform and gets their own updates, so there's no need to chase them here.";
    case "ai_unavailable":
    case "ai_failed":
      return "We couldn't draft a message just now. Try again in a moment.";
    default:
      return "We couldn't set up this chase. Try again.";
  }
}

export function ChaseNeighbourDrawer({ transactionId, direction, neighbourName, neighbourAddress, onClose }: Props) {
  const { theme, isNight } = usePortalTheme();
  const { toast } = useAgentToast();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  const doClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 200);
  }, [closing, onClose]);
  useOverlayChrome(doClose);

  const [tone, setTone] = useState<Tone>("Professional");
  const [drafting, setDrafting] = useState(true);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState<string | null>(neighbourName ?? null);
  const [email, setEmail] = useState<string | null>(null);
  const [stepName, setStepName] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const draft = useCallback(async (withTone: Tone) => {
    setDrafting(true);
    setErrorReason(null);
    const res = await draftNeighbourChaseAction({ transactionId, direction, tone: withTone }).catch(() => null);
    setDrafting(false);
    if (!res) { setErrorReason("ai_failed"); return; }
    if (!res.ok) { setErrorReason(res.reason); return; }
    setSubject(res.draft.subject);
    setBody(res.draft.body);
    setName(res.draft.neighbourName);
    setEmail(res.draft.neighbourEmail);
    setStepName(res.draft.stepName);
  }, [transactionId, direction]);

  // Draft once on open with the default tone.
  useEffect(() => { void draft("Professional"); }, [draft]);

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    const res = await sendNeighbourChaseAction({ transactionId, direction, subject, body }).catch(() => null);
    setSending(false);
    if (!res || !res.ok) {
      toast.error(res && !res.ok ? reasonMessage(res.reason, direction) : "Couldn't send the chase. Try again.");
      return;
    }
    toast.success(name ? `Chase sent to ${name}` : "Chase sent");
    onClose();
  }

  const whichNeighbour = direction === "onward" ? "above" : "below";
  const blocked = !!errorReason && errorReason !== "ai_unavailable" && errorReason !== "ai_failed";

  return createPortal(
    <div data-theme={theme} data-night={isNight ? "" : undefined} className={`fixed inset-0 flex justify-end${isNight ? " nv2-night" : ""}`} style={{ zIndex: 1000 }}>
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={doClose} />

      <div
        role="dialog"
        aria-label="Chase the neighbour agent"
        className="relative z-10 flex flex-col h-full"
        style={{
          width: "min(460px, 100vw)",
          background: "var(--agent-surface-elevated)",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          animation: closing
            ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards"
            : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* Header */}
        <div style={{ ...SHEET_BAND_STYLE, display: "flex", alignItems: "center", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SheetBandHeader
              kicker="Chain"
              title={`Chase the agent ${whichNeighbour}`}
            />
          </div>
          <button
            onClick={doClose}
            aria-label="Close"
            className="agent-icon-btn agent-icon-btn-sm"
            style={{ color: "rgba(255,255,255,0.85)", background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {blocked ? (
            <div className="rounded-xl px-4 py-4" style={{ background: "var(--agent-surface-subtle)", border: "1px solid var(--agent-border-default)" }}>
              <p className="text-sm" style={{ color: "var(--agent-text-primary)", lineHeight: 1.5 }}>
                {reasonMessage(errorReason!, direction)}
              </p>
            </div>
          ) : (
            <>
              {/* Recipient */}
              <div className="rounded-xl px-4 py-3" style={{ background: "var(--agent-surface-subtle)", border: "1px solid var(--agent-border-default)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--agent-text-secondary)" }}>To</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--agent-text-primary)" }}>
                  {name ?? `The agent ${whichNeighbour} in the chain`}
                </p>
                {email && <p className="text-xs mt-0.5" style={{ color: "var(--agent-text-muted)" }}>{email}</p>}
                {neighbourAddress && <p className="text-xs mt-0.5" style={{ color: "var(--agent-text-muted)" }}>{neighbourAddress}</p>}
              </div>

              {/* What we're asking */}
              <p className="text-xs" style={{ color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                {stepName
                  ? `Asking them to confirm whether this has happened on their side: ${stepName}.`
                  : "Asking them for a general update on their side of the chain."}
              </p>

              {/* Tone */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--agent-text-secondary)" }}>Tone</p>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => {
                    const active = t === tone;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setTone(t); void draft(t); }}
                        disabled={drafting || sending}
                        className="text-xs font-medium rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
                        style={{
                          border: `1px solid ${active ? "var(--agent-coral)" : "var(--agent-border-default)"}`,
                          background: active ? "var(--agent-coral-tint, rgba(255,107,74,0.1))" : "transparent",
                          color: active ? "var(--agent-coral-deep, var(--agent-text-primary))" : "var(--agent-text-secondary)",
                        }}
                      >
                        {TONE_DISPLAY[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold" style={{ color: "var(--agent-text-secondary)" }}>Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={drafting}
                  className="w-full glass-input agent-focus text-sm px-3 py-2 rounded-lg text-slate-900/90 transition-all"
                />
              </div>

              {/* Body */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold" style={{ color: "var(--agent-text-secondary)" }}>Message</label>
                  <button
                    type="button"
                    onClick={() => void draft(tone)}
                    disabled={drafting || sending}
                    className="inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
                    style={{ color: "var(--agent-coral-deep, var(--agent-text-primary))" }}
                  >
                    {drafting ? <CircleNotch size={13} className="animate-spin" /> : <Sparkle size={13} weight="fill" />}
                    {drafting ? "Drafting…" : "Regenerate"}
                  </button>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={drafting}
                  rows={12}
                  placeholder={drafting ? "Drafting…" : "Write your message…"}
                  className="w-full glass-input agent-focus text-sm px-3 py-2 rounded-lg text-slate-900/90 placeholder:text-slate-900/30 transition-all resize-none"
                  style={{ lineHeight: 1.6 }}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--agent-border-default)] bg-[var(--agent-surface-subtle)]">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="agent-btn agent-btn-neutral agent-btn-sm">
              {blocked ? "Close" : "Cancel"}
            </button>
            {!blocked && (
              <button
                onClick={() => { void handleSend(); }}
                disabled={drafting || sending || !body.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl agent-btn-color-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? <CircleNotch size={15} className="animate-spin" /> : <PaperPlaneTilt size={15} weight="fill" />}
                {sending ? "Sending…" : "Send chase"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
