"use client";

// Chase the neighbour agent above/below in the chain.
//
// A focused drawer — deliberately NOT the ChaseDrawer (which is built around
// ChaseTask + Contact recipients for client/solicitor chases and must stay
// untouched). It mirrors the real chase drawer's CONTROLS (glowing recipient
// card, Email/WhatsApp channel row with WhatsApp disabled for a cold agent, a
// tone dropdown, a Generate button, an optional client CC) but the recipient is
// a chain stub agent and there is no task. Loads the recipient on open and only
// writes the AI draft when Generate is pressed. Email-send is branded from the
// sending agent with their signature (same as any chase).
//
// Spec: docs/active/chain-agent-chase/00-spec.md Part C.

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, PaperPlaneTilt, CircleNotch, WarningCircle, ArrowsClockwise, ArrowSquareOut, CaretDown, CaretUp, ChatText, EnvelopeSimple, Sparkle } from "@phosphor-icons/react";
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
  getNeighbourChaseContextAction,
  setNeighbourAgentAction,
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
  // Per-step chase: the specific far-side step to ask about. Omitted → the
  // draft falls back to the tracker's next outstanding step.
  targetStepName?: string | null;
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

export function ChaseNeighbourDrawer({ transactionId, direction, neighbourName, neighbourAddress, onClose, onSent, targetStepName }: Props) {
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

  // Recipient / context (loaded on open, no AI).
  const [loadingContext, setLoadingContext] = useState(true);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(neighbourName ?? null);
  const [email, setEmail] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(neighbourAddress ?? null);
  const [stepName, setStepName] = useState<string | null>(targetStepName ?? null);
  const [lastChasedAt, setLastChasedAt] = useState<Date | string | null>(null);
  const [ccCandidate, setCcCandidate] = useState<{ name: string; email: string } | null>(null);

  // Compose.
  const [tone, setTone] = useState<Tone>("Professional");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);
  const [ccOn, setCcOn] = useState(false);

  // Tone dropdown (ported from the real chase drawer).
  const [toneMenuOpen, setToneMenuOpen] = useState(false);
  const [toneMenuPos, setToneMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const toneMenuRef = useRef<HTMLDivElement>(null);
  const closeToneMenu = useCallback(() => setToneMenuOpen(false), []);
  useEffect(() => {
    if (!toneMenuOpen) return;
    function onDown(e: MouseEvent) { if (toneMenuRef.current && !toneMenuRef.current.contains(e.target as Node)) closeToneMenu(); }
    function onScroll() { closeToneMenu(); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("scroll", onScroll, true); };
  }, [toneMenuOpen, closeToneMenu]);

  // Inline "add the agent's details" (when we have no email yet).
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [savingAgent, setSavingAgent] = useState(false);

  const hasGenerated = !isHtmlEmpty(bodyHtml);

  const loadContext = useCallback(async () => {
    setLoadingContext(true);
    setErrorReason(null);
    const res = await getNeighbourChaseContextAction({ transactionId, direction, stepName: targetStepName }).catch(() => null);
    setLoadingContext(false);
    if (!res) { setErrorReason("no_chain"); return; }
    if (!res.ok) { setErrorReason(res.reason); return; }
    const c = res.context;
    setName(c.neighbourName);
    setEmail(c.neighbourEmail);
    setAddress(c.neighbourAddress ?? neighbourAddress ?? null);
    setStepName(c.stepName);
    setLastChasedAt(c.lastChasedAt);
    setCcCandidate(c.ccCandidate);
    setSubject(`Quick update on ${c.neighbourAddress ?? neighbourAddress ?? "your side of the chain"}?`);
  }, [transactionId, direction, targetStepName, neighbourAddress]);

  useEffect(() => { void loadContext(); }, [loadContext]);

  const generate = useCallback(async (withTone: Tone) => {
    setGenerating(true);
    const res = await draftNeighbourChaseAction({ transactionId, direction, tone: withTone, stepName: targetStepName }).catch(() => null);
    setGenerating(false);
    if (!res) { toast.error("We couldn't draft a message just now. Try again in a moment."); return; }
    if (!res.ok) { toast.error(reasonMessage(res.reason, direction)); return; }
    setSubject(res.draft.subject);
    setBodyHtml(textToHtml(res.draft.body));
    setName(res.draft.neighbourName);
    setEmail(res.draft.neighbourEmail);
    setStepName(res.draft.stepName);
    setLastChasedAt(res.draft.lastChasedAt);
    setCcCandidate(res.draft.ccCandidate);
    setConfirmResend(false);
  }, [transactionId, direction, targetStepName, toast]);

  // Changing tone re-drafts in the new tone once a draft already exists (else it
  // just sets the tone the first Generate will use).
  function chooseTone(t: Tone) {
    setTone(t);
    closeToneMenu();
    if (hasGenerated) void generate(t);
  }

  async function saveAgent() {
    if (!agentEmail.includes("@")) return;
    setSavingAgent(true);
    const res = await setNeighbourAgentAction({ transactionId, direction, name: agentName, email: agentEmail }).catch(() => null);
    setSavingAgent(false);
    if (!res || !res.ok) { toast.error("Couldn't save the agent's details. Check the email and try again."); return; }
    setErrorReason(null);
    void loadContext();
  }

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
      includeCc: ccOn,
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
    if (ccOn && ccCandidate) params.set("cc", ccCandidate.email);
    params.set("subject", subject);
    params.set("body", htmlToText(bodyHtml));
    const query = params.toString().replace(/\+/g, "%20");
    window.location.href = `mailto:${email}?${query}`;
    toast.success("Opened in your email");
    onSent?.();
    onClose();
  }

  const whichNeighbour = direction === "onward" ? "above" : "below";
  // "no_email" gets the inline add-agent form; every other error is a hard block.
  const blocked = !!errorReason && errorReason !== "no_email";

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
          {loadingContext ? (
            <div className="flex items-center justify-center gap-2 py-10" style={{ color: "var(--agent-text-muted)" }}>
              <CircleNotch size={16} className="animate-spin" /> <span className="text-sm">Loading…</span>
            </div>
          ) : errorReason === "no_email" ? (
            <div className="rounded-xl px-4 py-4 space-y-3" style={{ background: "var(--agent-surface-subtle)", border: "1px solid var(--agent-border-default)" }}>
              <p className="text-sm" style={{ color: "var(--agent-text-primary)", lineHeight: 1.5 }}>
                We don&apos;t have an email for the agent {whichNeighbour}{address ? ` (handling ${address})` : ""}. Add their details to chase them — we&apos;ll save them against that property for next time.
              </p>
              <div className="space-y-1">
                <label className="block text-xs font-semibold" style={{ color: "var(--agent-text-secondary)" }}>Agent name (optional)</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Philippa Scott"
                  className="w-full glass-input agent-focus text-sm px-3 py-2 rounded-lg text-slate-900/90 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold" style={{ color: "var(--agent-text-secondary)" }}>Agent email</label>
                <input
                  type="email"
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  placeholder="agent@agency.co.uk"
                  className="w-full glass-input agent-focus text-sm px-3 py-2 rounded-lg text-slate-900/90 transition-all"
                />
              </div>
            </div>
          ) : blocked ? (
            <div className="rounded-xl px-4 py-4" style={{ background: "var(--agent-surface-subtle)", border: "1px solid var(--agent-border-default)" }}>
              <p className="text-sm" style={{ color: "var(--agent-text-primary)", lineHeight: 1.5 }}>
                {reasonMessage(errorReason!, direction)}
              </p>
            </div>
          ) : (
            <>
              {/* Recipient — glowing card matching the real chase drawer. */}
              <div
                className="rounded-xl px-4 py-3 flex items-start gap-3"
                style={{
                  background: "var(--agent-surface-glass)",
                  border: "0.5px solid var(--agent-border-subtle)",
                  boxShadow: "0 2px 12px rgba(var(--agent-coral-rgb), 0.10)",
                }}
              >
                <ContactAvatar contact={{ name: name ?? "Agent", roleType: "agent" }} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold" style={{ color: "var(--agent-text-secondary)" }}>To</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--agent-text-primary)" }}>
                    {name ?? `The agent ${whichNeighbour} in the chain`}
                  </p>
                  {email && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--agent-text-muted)" }}>{email}</p>}
                  {address && <p className="text-xs mt-0.5" style={{ color: "var(--agent-text-muted)" }}>{address}</p>}
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

              {/* Channel + Tone row — mirrors the real chase drawer. WhatsApp is
                  shown but disabled: we never WhatsApp a cold agent. */}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  <p className="agent-section-label" style={{ margin: "0 0 8px" }}>Channel</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      aria-pressed
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                        border: "1.5px solid var(--agent-coral)", backgroundColor: "var(--agent-coral)", color: "white",
                        cursor: "default", boxShadow: "0 4px 16px rgba(var(--agent-coral-rgb), 0.28)",
                      }}
                    >
                      <EnvelopeSimple size={15} weight="fill" /> Email
                    </button>
                    <button
                      type="button"
                      disabled
                      title="WhatsApp isn't available for a chain agent we haven't worked with"
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                        border: "0.5px solid var(--agent-border-subtle)", backgroundColor: "var(--agent-surface-glass)",
                        color: "var(--agent-text-muted)", cursor: "not-allowed", opacity: 0.5,
                      }}
                    >
                      <ChatText size={15} weight="regular" /> WhatsApp
                    </button>
                  </div>
                </div>

                {/* Tone dropdown */}
                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  <p className="agent-section-label" style={{ margin: "0 0 8px" }}>Tone</p>
                  <div style={{ position: "relative" }} ref={toneMenuRef}>
                    <button
                      type="button"
                      disabled={generating || sending}
                      onClick={() => {
                        if (!toneMenuOpen && toneMenuRef.current) {
                          const r = toneMenuRef.current.getBoundingClientRect();
                          setToneMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
                        }
                        setToneMenuOpen((o) => !o);
                      }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "9px 12px", borderRadius: 10, border: "0.5px solid var(--agent-border-subtle)",
                        background: "var(--agent-surface-glass)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                        color: "var(--agent-text-primary)",
                      }}
                    >
                      {TONE_DISPLAY[tone]}
                      <span style={{ color: "var(--agent-text-muted)", display: "flex" }}>
                        {toneMenuOpen ? <CaretUp size={13} /> : <CaretDown size={13} />}
                      </span>
                    </button>
                    {toneMenuOpen && toneMenuPos && typeof document !== "undefined" && createPortal(
                      <div
                        data-theme={theme}
                        data-night={isNight ? "" : undefined}
                        className="agent-dropdown-in"
                        style={{
                          position: "fixed", top: toneMenuPos.top, left: toneMenuPos.left, width: toneMenuPos.width,
                          zIndex: 9999, background: "var(--agent-surface-elevated)", backdropFilter: "blur(20px)",
                          borderRadius: 12, border: "0.5px solid var(--agent-border-subtle)",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden",
                        }}
                      >
                        {TONES.map((t) => (
                          <button
                            key={t}
                            onClick={() => chooseTone(t)}
                            style={{
                              width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 13, fontWeight: 500,
                              background: tone === t ? "rgba(var(--agent-coral-rgb), 0.10)" : "transparent",
                              color: tone === t ? "var(--agent-coral-deep)" : "var(--agent-text-primary)",
                              border: "none", cursor: "pointer",
                            }}
                          >
                            {TONE_DISPLAY[t]}
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold" style={{ color: "var(--agent-text-secondary)" }}>Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full glass-input agent-focus text-sm px-3 py-2 rounded-lg text-slate-900/90 transition-all"
                />
              </div>

              {/* Message — Generate button until a draft exists, then the composer. */}
              <div className="space-y-2">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p className="agent-section-label" style={{ margin: 0 }}>Message</p>
                  {hasGenerated && (
                    <button
                      type="button"
                      onClick={() => void generate(tone)}
                      disabled={generating || sending}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: "none", border: "none", padding: 0,
                        cursor: generating || sending ? "not-allowed" : "pointer",
                        fontSize: 11.5, fontWeight: 600, color: "var(--agent-coral-deep)",
                        opacity: generating || sending ? 0.5 : 1, transition: "opacity 140ms",
                      }}
                    >
                      <ArrowsClockwise size={13} weight="bold" className={generating ? "animate-spin" : undefined} /> {generating ? "Drafting…" : "Regenerate"}
                    </button>
                  )}
                </div>

                {hasGenerated ? (
                  <>
                    <ChaseComposer
                      valueHtml={bodyHtml}
                      onChangeHtml={(html) => { setBodyHtml(html); setConfirmResend(false); }}
                      placeholder="Write your message…"
                      attachments={[]}
                      onAttachmentsChange={() => {}}
                      charCount={htmlToText(bodyHtml).length}
                    />
                    <ChaseSignaturePreview transactionId={transactionId} visible={!isHtmlEmpty(bodyHtml)} />
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void generate(tone)}
                      disabled={generating}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "white",
                        border: "none", cursor: generating ? "not-allowed" : "pointer",
                        background: generating
                          ? "rgba(var(--agent-coral-rgb), 0.5)"
                          : "linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))",
                        boxShadow: generating ? "none" : "0 4px 20px rgba(var(--agent-coral-rgb), 0.32)",
                      }}
                    >
                      {generating
                        ? <><CircleNotch size={15} className="animate-spin" />Drafting…</>
                        : <><Sparkle size={15} weight="fill" />Generate message</>}
                    </button>
                    <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)", textAlign: "center" }}>
                      We&apos;ll draft a chase based on this property, the agent and tone.
                    </p>
                  </>
                )}
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

        {/* Footer */}
        <div className="glass-v03" style={{ padding: "14px 20px 18px", border: "none", borderTop: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)" }}>
          {loadingContext ? (
            <button onClick={onClose} className="agent-btn agent-btn-neutral agent-btn-sm">Close</button>
          ) : errorReason === "no_email" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => void saveAgent()}
                disabled={savingAgent || !agentEmail.includes("@")}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "white", border: "none",
                  cursor: savingAgent || !agentEmail.includes("@") ? "not-allowed" : "pointer",
                  background: savingAgent || !agentEmail.includes("@")
                    ? "rgba(var(--agent-coral-rgb), 0.35)"
                    : "linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))",
                }}
              >
                {savingAgent ? <><CircleNotch size={15} className="animate-spin" />Saving…</> : "Save & continue"}
              </button>
              <button onClick={doClose} className="agent-btn agent-btn-neutral agent-btn-sm">Cancel</button>
            </div>
          ) : blocked ? (
            <button onClick={onClose} className="agent-btn agent-btn-neutral agent-btn-sm">Close</button>
          ) : (
            <>
              {ccCandidate && (
                <label
                  style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12.5, color: "var(--agent-text-secondary)", cursor: "pointer" }}
                  title={`Also copy ${ccCandidate.name} on this email`}
                >
                  <input type="checkbox" checked={ccOn} onChange={(e) => setCcOn(e.target.checked)} />
                  CC {ccCandidate.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>(your client)</span>
                </label>
              )}
              <button
                onClick={() => { void handleSend(confirmResend); }}
                disabled={!hasGenerated || generating || sending}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "13px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  border: "none", cursor: !hasGenerated || generating || sending ? "not-allowed" : "pointer",
                  transition: "all 160ms",
                  background: !hasGenerated || sending
                    ? "rgba(var(--agent-coral-rgb), 0.35)"
                    : "linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))",
                  color: "white",
                  boxShadow: !hasGenerated || sending ? "none" : "0 4px 20px rgba(var(--agent-coral-rgb), 0.28)",
                }}
              >
                {sending
                  ? <><CircleNotch size={15} className="animate-spin" />Sending…</>
                  : <><PaperPlaneTilt size={15} weight="fill" />{confirmResend ? "Send anyway" : "Send chase"}</>}
              </button>

              <button
                onClick={() => { void handleOpenInMyEmail(confirmResend); }}
                disabled={!hasGenerated || !email || generating || sending}
                title="Opens your own email app with this ready to send"
                style={{
                  marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "11px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                  border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)",
                  color: (!hasGenerated || !email) ? "var(--agent-text-tertiary)" : "var(--agent-text-primary)",
                  cursor: (!hasGenerated || !email || generating || sending) ? "not-allowed" : "pointer",
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
