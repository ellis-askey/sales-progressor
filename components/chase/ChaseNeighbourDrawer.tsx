"use client";

// Chase the neighbour agent above/below in the chain.
//
// A focused, lean drawer — deliberately NOT the ChaseDrawer (which is built around
// ChaseTask + Contact recipients for client/solicitor chases and must stay
// untouched). It reuses the AI phrasing engine and the rich ChaseComposer, but the
// recipient is a chain stub agent and there is no task. Email only. The send is
// branded from the sending agent with their signature (same as any chase).
//
// Spec: docs/active/chain-agent-chase/00-spec.md Part C.

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, PaperPlaneTilt, CircleNotch, WarningCircle, ArrowsClockwise, ArrowSquareOut } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useOverlayChrome } from "@/lib/agent/use-overlay-chrome";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { ChaseComposer } from "@/components/chase/ChaseComposer";
import { ChaseSignaturePreview } from "@/components/chase/ChaseSignaturePreview";
import { ContactAvatar } from "@/components/ui/Avatar";
import { textToHtml, htmlToText, isHtmlEmpty } from "@/lib/chase/rich-text";
import {
  draftNeighbourChaseAction,
  sendNeighbourChaseAction,
  openNeighbourChaseInEmailAction,
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
  neighbourName?: string | null;
  neighbourAddress?: string | null;
  onClose: () => void;
  // Fired after a chase is successfully sent (either path) so the parent can
  // refresh the chain activity feed without waiting for a reopen.
  onSent?: () => void;
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
      return "That agent already has an account with us and gets their own updates, so there's no need to chase them here.";
    case "ai_unavailable":
    case "ai_failed":
      return "We couldn't draft a message just now. Try again in a moment.";
    default:
      return "We couldn't set up this chase. Try again.";
  }
}

function relativeAgo(value: Date | string | null): string {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function ChaseNeighbourDrawer({ transactionId, direction, neighbourName, neighbourAddress, onClose, onSent }: Props) {
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
  const [bodyHtml, setBodyHtml] = useState("");
  const [name, setName] = useState<string | null>(neighbourName ?? null);
  const [email, setEmail] = useState<string | null>(null);
  const [stepName, setStepName] = useState<string | null>(null);
  const [lastChasedAt, setLastChasedAt] = useState<Date | string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);

  const draft = useCallback(async (withTone: Tone) => {
    setDrafting(true);
    setErrorReason(null);
    const res = await draftNeighbourChaseAction({ transactionId, direction, tone: withTone }).catch(() => null);
    setDrafting(false);
    if (!res) { setErrorReason("ai_failed"); return; }
    if (!res.ok) { setErrorReason(res.reason); return; }
    setSubject(res.draft.subject);
    setBodyHtml(textToHtml(res.draft.body));
    setName(res.draft.neighbourName);
    setEmail(res.draft.neighbourEmail);
    setStepName(res.draft.stepName);
    setLastChasedAt(res.draft.lastChasedAt);
  }, [transactionId, direction]);

  // Draft once on open with the default tone.
  useEffect(() => { void draft("Professional"); }, [draft]);

  async function handleSend(force: boolean) {
    if (isHtmlEmpty(bodyHtml)) return;
    setSending(true);
    const res = await sendNeighbourChaseAction({
      transactionId,
      direction,
      subject,
      bodyHtml,
      bodyText: htmlToText(bodyHtml),
      force,
    }).catch(() => null);
    setSending(false);
    if (!res || !res.ok) {
      if (res && !res.ok && res.reason === "recently_chased" && !force) {
        setLastChasedAt(res.lastChasedAt ?? lastChasedAt);
        setConfirmResend(true);
        return;
      }
      toast.error(res && !res.ok ? reasonMessage(res.reason, direction) : "Couldn't send the chase, try again.");
      return;
    }
    toast.success(name ? `Chase sent to ${name}` : "Chase sent");
    onSent?.();
    onClose();
  }

  // Second path: log it (not app-sent) and open the agent's own mail client.
  async function handleOpenInMyEmail(force: boolean) {
    if (isHtmlEmpty(bodyHtml) || !email) return;
    setSending(true);
    const res = await openNeighbourChaseInEmailAction({
      transactionId,
      direction,
      subject,
      bodyText: htmlToText(bodyHtml),
      force,
    }).catch(() => null);
    setSending(false);
    if (!res || !res.ok) {
      if (res && !res.ok && res.reason === "recently_chased" && !force) {
        setLastChasedAt(res.lastChasedAt ?? lastChasedAt);
        setConfirmResend(true);
        return;
      }
      toast.error(res && !res.ok ? reasonMessage(res.reason, direction) : "Couldn't open your email, try again.");
      return;
    }
    const params = new URLSearchParams();
    params.set("subject", subject);
    params.set("body", htmlToText(bodyHtml));
    const query = params.toString().replace(/\+/g, "%20");
    window.location.href = `mailto:${email}?${query}`;
    toast.success("Opened in your email");
    onSent?.();
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
          width: "min(480px, 100vw)",
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
            <SheetBandHeader kicker="Chain" title={`Chase the agent ${whichNeighbour}`} />
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
              <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "var(--agent-surface-subtle)", border: "1px solid var(--agent-border-default)" }}>
                <ContactAvatar contact={{ name: name ?? "Agent", roleType: "agent" }} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold" style={{ color: "var(--agent-text-secondary)" }}>To</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--agent-text-primary)" }}>
                    {name ?? `The agent ${whichNeighbour} in the chain`}
                  </p>
                  {email && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--agent-text-muted)" }}>{email}</p>}
                  {neighbourAddress && <p className="text-xs mt-0.5" style={{ color: "var(--agent-text-muted)" }}>{neighbourAddress}</p>}
                  {lastChasedAt && (
                    <p className="text-xs mt-1.5" style={{ color: "var(--agent-text-muted)" }}>
                      Last chased {relativeAgo(lastChasedAt)}
                    </p>
                  )}
                </div>
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

              {/* Message — label + Regenerate match the real chase drawer. */}
              <div className="space-y-2">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p className="agent-section-label" style={{ margin: 0 }}>Message</p>
                  <button
                    type="button"
                    onClick={() => void draft(tone)}
                    disabled={drafting || sending}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      background: "none", border: "none", padding: 0,
                      cursor: drafting || sending ? "not-allowed" : "pointer",
                      fontSize: 11.5, fontWeight: 600, color: "var(--agent-coral-deep)",
                      opacity: drafting || sending ? 0.5 : 1, transition: "opacity 140ms",
                    }}
                  >
                    <ArrowsClockwise size={13} weight="bold" className={drafting ? "animate-spin" : undefined} /> {drafting ? "Drafting…" : "Regenerate"}
                  </button>
                </div>
                <ChaseComposer
                  valueHtml={bodyHtml}
                  onChangeHtml={(html) => { setBodyHtml(html); setConfirmResend(false); }}
                  placeholder={drafting ? "Drafting…" : "Write your message…"}
                  attachments={[]}
                  onAttachmentsChange={() => {}}
                  charCount={htmlToText(bodyHtml).length}
                />
                {/* Rendered sign-off preview — same component + look as the real chase drawer. */}
                <ChaseSignaturePreview transactionId={transactionId} visible={!isHtmlEmpty(bodyHtml)} />
              </div>

              {confirmResend && (
                <div className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={{ background: "rgba(245,158,11,0.08)", border: "0.5px solid rgba(245,158,11,0.3)" }}>
                  <WarningCircle size={15} weight="fill" style={{ color: "#b45309", flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: "var(--agent-text-primary)", lineHeight: 1.5 }}>
                    You chased this agent {relativeAgo(lastChasedAt)}. Send another chase?
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer / Send — same layout, styling and behaviour as the real chase
            drawer (email only: no channel toggle, no attachments, no CC). */}
        <div className="glass-v03" style={{ padding: "14px 20px 18px", border: "none", borderTop: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)" }}>
          {blocked ? (
            <button onClick={onClose} className="agent-btn agent-btn-neutral agent-btn-sm">Close</button>
          ) : (
            <>
              <button
                onClick={() => { void handleSend(confirmResend); }}
                disabled={isHtmlEmpty(bodyHtml) || drafting || sending}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "13px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  border: "none", cursor: isHtmlEmpty(bodyHtml) || drafting || sending ? "not-allowed" : "pointer",
                  transition: "all 160ms",
                  background: isHtmlEmpty(bodyHtml) || sending
                    ? "rgba(var(--agent-coral-rgb), 0.35)"
                    : "linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))",
                  color: "white",
                  boxShadow: isHtmlEmpty(bodyHtml) || sending ? "none" : "0 4px 20px rgba(var(--agent-coral-rgb), 0.28)",
                }}
              >
                {sending
                  ? <><CircleNotch size={15} className="animate-spin" />Sending…</>
                  : <><PaperPlaneTilt size={15} weight="fill" />{confirmResend ? "Send anyway" : "Send chase"}</>}
              </button>

              <button
                onClick={() => { void handleOpenInMyEmail(confirmResend); }}
                disabled={isHtmlEmpty(bodyHtml) || !email || drafting || sending}
                title="Opens your own email app with this ready to send"
                style={{
                  marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "11px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                  border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)",
                  color: (isHtmlEmpty(bodyHtml) || !email) ? "var(--agent-text-tertiary)" : "var(--agent-text-primary)",
                  cursor: (isHtmlEmpty(bodyHtml) || !email || drafting || sending) ? "not-allowed" : "pointer",
                  transition: "all 150ms",
                }}
              >
                <ArrowSquareOut size={15} weight="bold" /> Open in my email
              </button>
              <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--agent-text-tertiary)", textAlign: "center", lineHeight: 1.45 }}>
                Sends from your own inbox. We&apos;ll log it as chased.
              </p>

              <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center", lineHeight: 1.5 }}>
                {email ? `To: ${email}` : "No email on file. This will be logged, not sent"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
