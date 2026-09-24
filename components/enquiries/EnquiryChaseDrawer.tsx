"use client";

// Send-a-chase drawer for the enquiries loop — the enquiries twin of the chase
// drawer, and deliberately near-identical below the recipient: the same rich-text
// composer, the same tone control, the same Generate/Regenerate, the same signature
// preview + "Open in my email" handoff. It opens INSTANTLY from props (no fetch, no
// loading screen): the recipient is the solicitor whose court the loop is in, the
// recipient-side clients are CC'd by default, and the body starts empty.
//
// Generate hits /api/ai/generate-enquiry-chase, which knows the real state of the
// loop (rounds, replies in/partial, times chased, whether searches are back) and
// writes the right chase for the moment. Send hits sendEnquiryChaseAction, which
// re-resolves the recipient + sender + /s/ token server-side, appends the sender's
// own signature, logs it, and resets the quiet clock so the loop drops off the hub.
//
// Built on the canonical Drawer primitive.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PaperPlaneTilt, IdentificationCard, ArrowSquareOut, CircleNotch, Sparkle, ArrowsClockwise, CaretDown, CaretUp } from "@phosphor-icons/react";
import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { ChaseComposer, type ChaseAttachment } from "@/components/chase/ChaseComposer";
import { ChaseSignaturePreview } from "@/components/chase/ChaseSignaturePreview";
import { textToHtml, htmlToText, isHtmlEmpty } from "@/lib/chase/rich-text";
import { sendEnquiryChaseAction } from "@/app/actions/enquiries";

type Court = "seller_solicitor" | "buyer_solicitor";
type Tone = "Friendly" | "Professional" | "Polite Yet Firm" | "Chase Up" | "Urgent" | "Final Reminder";

const TONES: Tone[] = ["Friendly", "Professional", "Polite Yet Firm", "Chase Up", "Urgent", "Final Reminder"];
// Tone escalates with how many times we've already chased.
function autoTone(chaseCount: number): Tone {
  return TONES[Math.min(Math.max(0, chaseCount), TONES.length - 1)];
}
// Coloured-dot tone scale — copied from ChaseDrawer (functional colours, no theming).
const TONE_META: Record<Tone, { dot: string }> = {
  "Friendly": { dot: "#16a34a" },
  "Professional": { dot: "#2563eb" },
  "Polite Yet Firm": { dot: "#ca8a04" },
  "Chase Up": { dot: "#ea580c" },
  "Urgent": { dot: "#dc2626" },
  "Final Reminder": { dot: "#991b1b" },
};
const TONE_DISPLAY: Record<Tone, string> = {
  "Friendly": "Friendly",
  "Professional": "Professional",
  "Polite Yet Firm": "Polite yet firm",
  "Chase Up": "Chase up",
  "Urgent": "Urgent",
  "Final Reminder": "Final reminder",
};

function TonePill({ tone }: { tone: Tone }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE_META[tone].dot, flexShrink: 0 }} />
      {TONE_DISPLAY[tone]}
    </span>
  );
}

const courtLabel = (c: Court) => (c === "seller_solicitor" ? "Seller's solicitor" : "Buyer's solicitor");

// Subject, derived client-side to match the template (house convention):
//   "Purchase of <address>, Client: <name>"  (buyer's solicitor)
//   "Sale of <address>, Clients: <a> & <b>"   (seller's solicitor)
function deriveSubject(court: Court, address: string, clientNames: string[]): string {
  const deal = court === "buyer_solicitor" ? "Purchase" : "Sale";
  const names = clientNames.filter(Boolean);
  if (names.length === 0) return `${deal} of ${address}`;
  const label = names.length === 1 ? "Client" : "Clients";
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  return `${deal} of ${address}, ${label}: ${joined}`;
}

// Read a picked file into a base64 attachment for the send action (as ChaseDrawer does).
async function fileToAttachment(file: File): Promise<{ content: string; filename: string; type: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  return { content: base64, filename: file.name, type: file.type || "application/octet-stream" };
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--agent-text-tertiary)", margin: "0 0 7px",
};
const fieldStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
  fontSize: 13, outline: "none", fontFamily: "inherit",
};

export function EnquiryChaseDrawer({
  open,
  transactionId,
  address,
  court,
  solicitorName,
  solicitorEmail,
  ccCandidates,
  chaseCount,
  onClose,
  onSent,
}: {
  open: boolean;
  transactionId: string;
  address: string;
  court: Court;
  solicitorName: string | null;
  solicitorEmail: string | null;
  ccCandidates: { contactId: string; name: string; email: string | null }[];
  chaseCount: number;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { toast } = useAgentToast();
  const { theme, isNight } = usePortalTheme();

  const clientNames = ccCandidates.map((c) => c.name);
  const firstLine = address.split(",")[0].trim() || address;
  const hasSolicitor = !!solicitorName;

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(""); // rich-text HTML from the composer
  const [attachments, setAttachments] = useState<ChaseAttachment[]>([]);
  const [ccOff, setCcOff] = useState<Set<string>>(new Set()); // CC on by default → track who's OFF
  const [tone, setTone] = useState<Tone>("Professional");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Tone dropdown (portal, mirrors ChaseDrawer). The menu portals to <body>, so the
  // outside-click check must exclude BOTH the trigger and the menu, or a click on an
  // option closes the menu before it registers (the "locked tone" bug).
  const [toneOpen, setToneOpen] = useState(false);
  const [tonePos, setTonePos] = useState<{ top: number; left: number; width: number } | null>(null);
  const toneRef = useRef<HTMLDivElement>(null);
  const toneMenuRef = useRef<HTMLDivElement>(null);

  // Reset fields each time the drawer opens for a (new) loop. No fetch — instant.
  useEffect(() => {
    if (!open) return;
    setSubject(deriveSubject(court, address, clientNames));
    setMessage("");
    setAttachments([]);
    setCcOff(new Set());
    setTone(autoTone(chaseCount));
    setGenError(null);
    setSendError(null);
    setToneOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transactionId]);

  useEffect(() => {
    if (!toneOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (toneRef.current?.contains(t)) return;
      if (toneMenuRef.current?.contains(t)) return;
      setToneOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [toneOpen]);

  const msgEmpty = isHtmlEmpty(message);
  const hasAttachments = attachments.length > 0;
  const selectedCcEmails = ccCandidates.filter((c) => !ccOff.has(c.contactId) && c.email).map((c) => c.email as string);

  async function handleGenerate() {
    if (!hasSolicitor || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const r = await fetch("/api/ai/generate-enquiry-chase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, tone }),
      });
      const d = await r.json();
      if (r.status === 429) { setGenError(d.message ?? "Too many requests. Wait a few minutes and try again."); return; }
      if (!r.ok) { setGenError(d.error ?? "Couldn't generate a draft. Try again."); return; }
      if (d.generated) setMessage(textToHtml(d.generated));
    } catch {
      setGenError("Something went wrong. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (msgEmpty || sending) return;
    setSending(true);
    setSendError(null);
    const ccContactIds = ccCandidates.filter((c) => !ccOff.has(c.contactId)).map((c) => c.contactId);
    try {
      const emailAttachments = attachments.length ? await Promise.all(attachments.map((a) => fileToAttachment(a.file))) : undefined;
      const res = await sendEnquiryChaseAction({
        transactionId, subject, bodyHtml: message, bodyText: htmlToText(message), ccContactIds,
        ...(emailAttachments ? { attachments: emailAttachments } : {}),
      });
      if (res.ok) { toast.success("Chase sent"); onSent?.(); onClose(); }
      else setSendError(res.error ?? "Couldn't send. Try again.");
    } catch {
      setSendError("Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  // Hand off to the agent's own mail app: log it on faith + reset the clock, then
  // open a mailto the server composed (with the /s/ update link). No attachments.
  async function handleOpenInMyEmail() {
    if (msgEmpty || sending || hasAttachments) return;
    setSending(true);
    setSendError(null);
    const ccContactIds = ccCandidates.filter((c) => !ccOff.has(c.contactId)).map((c) => c.contactId);
    try {
      const res = await sendEnquiryChaseAction({ transactionId, subject, bodyHtml: message, bodyText: htmlToText(message), ccContactIds, logOnly: true });
      if (res.ok && res.mailto) {
        const params = new URLSearchParams();
        if (res.mailto.cc.length) params.set("cc", res.mailto.cc.join(","));
        params.set("subject", res.mailto.subject);
        params.set("body", res.mailto.body);
        window.location.href = `mailto:${res.mailto.to}?${params.toString().replace(/\+/g, "%20")}`;
        toast.success("Opened in your email");
        onSent?.();
        onClose();
      } else {
        setSendError(res.error ?? "Couldn't open your email. Try again.");
      }
    } catch {
      setSendError("Couldn't open your email. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} ariaLabel="Send enquiry chase" size="md" closeTone="onDark" zLayer="escalated">
      {/* Coral band header */}
      <div style={{ ...SHEET_BAND_STYLE, flexShrink: 0 }}>
        <SheetBandHeader kicker="Chase enquiries" title="Send a chase" subtitle={firstLine} />
      </div>

      <Drawer.Body>
        {!hasSolicitor ? (
          <div style={{ padding: "36px 8px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              No {court === "seller_solicitor" ? "seller's" : "buyer's"} solicitor on file yet.
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>Add one on the file, then you can chase them here.</p>
            <Link href={`/agent/transactions/${transactionId}`} className="agent-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 12.5, fontWeight: 600 }}>
              Open the file <ArrowSquareOut size={13} weight="bold" />
            </Link>
          </div>
        ) : (
          <>
            {/* Recipient — fixed to the court solicitor */}
            <p style={labelStyle}>To</p>
            <div style={{ display: "flex", alignItems: "center", gap: 11, background: "var(--agent-surface-glass)", border: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)", borderRadius: 12, padding: "11px 13px" }}>
              <span aria-hidden style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(var(--agent-coral-rgb), 0.10)", color: "var(--agent-coral-deep)" }}>
                <IdentificationCard size={19} weight="fill" />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{solicitorName}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>{courtLabel(court)} · email only</p>
              </div>
            </div>

            {/* CC clients — on by default */}
            {ccCandidates.length > 0 && (
              <>
                <p style={{ ...labelStyle, marginTop: 18 }}>Cc the {court === "seller_solicitor" ? "seller" : "buyer"}{ccCandidates.length > 1 ? "s" : ""}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {ccCandidates.map((c) => {
                    const on = !ccOff.has(c.contactId);
                    return (
                      <button
                        key={c.contactId}
                        type="button"
                        onClick={() => setCcOff((prev) => { const n = new Set(prev); if (n.has(c.contactId)) n.delete(c.contactId); else n.add(c.contactId); return n; })}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", borderRadius: 10,
                          border: on ? "0.5px solid rgba(var(--agent-coral-rgb), 0.18)" : "0.5px solid var(--agent-border-subtle)",
                          background: on ? "rgba(var(--agent-coral-rgb), 0.05)" : "var(--agent-surface-glass)",
                          cursor: "pointer", transition: "all 140ms",
                        }}
                      >
                        <span data-sensitive="true" style={{ fontSize: 12, fontWeight: 500, color: on ? "var(--agent-coral-deep)" : "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                          CC {c.name}
                        </span>
                        <span style={{ width: 34, height: 18, borderRadius: 9, display: "flex", alignItems: "center", background: on ? "var(--agent-coral-deep)" : "var(--agent-border-subtle)", transition: "background 140ms", flexShrink: 0 }}>
                          <span style={{ width: 14, height: 14, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.20)", marginLeft: on ? 16 : 2, transition: "margin-left 140ms" }} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Tone */}
            <p style={{ ...labelStyle, marginTop: 18 }}>Tone</p>
            <div style={{ position: "relative" }} ref={toneRef}>
              <button
                type="button"
                onClick={() => {
                  if (!toneOpen && toneRef.current) {
                    const r = toneRef.current.getBoundingClientRect();
                    setTonePos({ top: r.bottom + 4, left: r.left, width: r.width });
                  }
                  setToneOpen((v) => !v);
                }}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 10, border: "0.5px solid var(--agent-border-subtle)", background: "var(--agent-surface-glass)", cursor: "pointer" }}
              >
                <TonePill tone={tone} />
                <span style={{ color: "var(--agent-text-muted)", display: "flex" }}>{toneOpen ? <CaretUp size={13} /> : <CaretDown size={13} />}</span>
              </button>
              {toneOpen && tonePos && typeof document !== "undefined" && createPortal(
                <div
                  ref={toneMenuRef}
                  data-theme={theme}
                  data-night={isNight ? "" : undefined}
                  className="agent-dropdown-in"
                  style={{ position: "fixed", top: tonePos.top, left: tonePos.left, width: tonePos.width, zIndex: 9999, background: "var(--agent-surface-elevated)", backdropFilter: "blur(20px)", borderRadius: 12, border: "0.5px solid var(--agent-border-subtle)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden" }}
                >
                  {TONES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setTone(t); setToneOpen(false); }}
                      style={{ width: "100%", textAlign: "left", padding: "8px 12px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, background: tone === t ? "rgba(var(--agent-coral-rgb), 0.10)" : "transparent", border: "none", cursor: "pointer", transition: "background 100ms" }}
                    >
                      <TonePill tone={t} />
                      {t === autoTone(chaseCount) && <span style={{ fontSize: 10, color: "var(--agent-text-tertiary)", paddingLeft: 14 }}>Recommended</span>}
                    </button>
                  ))}
                </div>,
                document.body,
              )}
            </div>

            {/* Generate */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              style={{
                marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "11px 0", borderRadius: 12,
                background: generating ? "rgba(var(--agent-coral-rgb), 0.40)" : "linear-gradient(135deg, var(--agent-coral-deep) 0%, var(--agent-coral-light) 100%)",
                border: "none", color: "white", fontSize: 13, fontWeight: 700,
                cursor: generating ? "not-allowed" : "pointer",
                boxShadow: generating ? "none" : "0 4px 20px rgba(var(--agent-coral-rgb), 0.32)",
                transition: "all 160ms",
              }}
            >
              {generating ? <><CircleNotch size={15} className="agent-spin" />Generating…</> : <><Sparkle size={15} weight="fill" />Generate message</>}
            </button>
            {msgEmpty && !generating && (
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center", lineHeight: 1.45 }}>
                We&rsquo;ll write the chase from what we know: whose court it&rsquo;s in, how many rounds, what&rsquo;s replied, and whether searches are back.
              </p>
            )}

            {/* Subject */}
            <p style={{ ...labelStyle, marginTop: 16 }}>Subject</p>
            <input className="agent-field" value={subject} onChange={(e) => setSubject(e.target.value)} style={fieldStyle} />

            {/* Message + Regenerate */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 8px" }}>
              <p style={{ ...labelStyle, margin: 0 }}>Message</p>
              {!msgEmpty && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0, cursor: generating ? "not-allowed" : "pointer", fontSize: 11.5, fontWeight: 600, color: "var(--agent-coral-deep)", opacity: generating ? 0.5 : 1 }}
                >
                  <ArrowsClockwise size={13} weight="bold" className={generating ? "agent-spin" : undefined} /> Regenerate
                </button>
              )}
            </div>
            <ChaseComposer
              valueHtml={message}
              onChangeHtml={setMessage}
              placeholder="Generate a chase or type your own…"
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              charCount={htmlToText(message).length}
            />
            {genError && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--agent-danger, #dc2626)" }}>{genError}</p>}

            {/* Rendered sign-off preview — the sender's own signature the send appends. */}
            <div style={{ marginTop: 14 }}>
              <ChaseSignaturePreview transactionId={transactionId} visible={!msgEmpty} />
            </div>

            {sendError && <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--agent-danger, #dc2626)" }}>{sendError}</p>}
          </>
        )}
      </Drawer.Body>

      <Drawer.Footer style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        {hasSolicitor ? (
          <>
            <button
              type="button"
              onClick={handleSend}
              disabled={msgEmpty || sending}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, border: "none",
                cursor: msgEmpty || sending ? "not-allowed" : "pointer", transition: "all 160ms", color: "white",
                background: msgEmpty || sending ? "rgba(var(--agent-coral-rgb), 0.35)" : "linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))",
                boxShadow: msgEmpty || sending ? "none" : "0 4px 20px rgba(var(--agent-coral-rgb), 0.28)",
              }}
            >
              {sending ? <><CircleNotch size={15} className="agent-spin" />Sending…</> : <><PaperPlaneTilt size={15} weight="fill" />Send chase</>}
            </button>
            <button
              type="button"
              onClick={handleOpenInMyEmail}
              disabled={msgEmpty || sending || hasAttachments || !solicitorEmail}
              title={hasAttachments ? "Remove attachments to use your own email app" : "Opens your own email app with this ready to send"}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "11px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)",
                color: (msgEmpty || hasAttachments || !solicitorEmail) ? "var(--agent-text-tertiary)" : "var(--agent-text-primary)",
                cursor: (msgEmpty || sending || hasAttachments || !solicitorEmail) ? "not-allowed" : "pointer", transition: "all 150ms",
              }}
            >
              <ArrowSquareOut size={15} weight="bold" /> Open in my email
            </button>
            <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "var(--agent-text-tertiary)", textAlign: "center", lineHeight: 1.45 }}>
              {hasAttachments ? "Files send with Send chase only. Open in my email can't carry attachments." : "Sends from your own inbox. We'll log it as chased."}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center", lineHeight: 1.5 }} data-sensitive="true">
              {solicitorEmail
                ? <>To: {solicitorEmail}{selectedCcEmails.length ? ` · CC: ${selectedCcEmails.join(", ")}` : ""}</>
                : "No email on file for this solicitor."}
            </p>
          </>
        ) : (
          <button type="button" className="agent-btn agent-btn-neutral agent-btn-sm" onClick={onClose} style={{ marginLeft: "auto" }}>Close</button>
        )}
      </Drawer.Footer>
    </Drawer>
  );
}
