"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, EnvelopeSimple, ChatText, Sparkle, PaperPlaneTilt, CircleNotch, CaretDown, CaretUp } from "@phosphor-icons/react";

type Channel = "email" | "whatsapp";
type Tone = "Friendly" | "Professional" | "Polite Yet Firm" | "Chase Up" | "Urgent" | "Final Reminder";

const TONES: Tone[] = ["Friendly", "Professional", "Polite Yet Firm", "Chase Up", "Urgent", "Final Reminder"];

function autoTone(chaseCount: number): Tone {
  const map: Tone[] = ["Friendly", "Professional", "Polite Yet Firm", "Chase Up", "Urgent", "Final Reminder"];
  return map[Math.min(chaseCount - 1, map.length - 1)] ?? "Friendly";
}

const TONE_META: Record<Tone, { pill: string; dot: string }> = {
  "Friendly":        { pill: "#dcfce7", dot: "#16a34a" },
  "Professional":    { pill: "#dbeafe", dot: "#2563eb" },
  "Polite Yet Firm": { pill: "#fef9c3", dot: "#ca8a04" },
  "Chase Up":        { pill: "#ffedd5", dot: "#ea580c" },
  "Urgent":          { pill: "#fee2e2", dot: "#dc2626" },
  "Final Reminder":  { pill: "#fecaca", dot: "#991b1b" },
};

interface MilestoneRef {
  chaseTaskId: string;
  name: string;
  chaseCount: number;
}

interface Contact {
  id: string;
  name: string;
  roleType: string;
  email?: string | null;
  phone?: string | null;
}

interface ChaseDrawerProps {
  chaseTaskId: string;
  transactionId: string;
  propertyAddress: string;
  milestoneName: string;
  chaseCount: number;
  contacts: Contact[];
  milestones?: MilestoneRef[];
  onClose: () => void;
  onSent: () => void;
}

type SendResult = { ok: boolean; emailSent?: boolean; error?: string };

function TonePill({ tone }: { tone: Tone }) {
  const { pill, dot } = TONE_META[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
      background: pill, color: "#1a1a1a",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      {tone}
    </span>
  );
}

function initials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

export function ChaseDrawer({
  chaseTaskId,
  transactionId,
  propertyAddress,
  milestoneName,
  chaseCount,
  contacts,
  milestones,
  onClose,
  onSent,
}: ChaseDrawerProps) {
  const isMulti = Array.isArray(milestones) && milestones.length > 1;
  const effectiveChaseCount = isMulti
    ? Math.max(...milestones!.map((m) => m.chaseCount))
    : chaseCount;
  const nextChaseNumber = effectiveChaseCount + 1;

  // Client = vendor/purchaser/broker; solicitor is always CC candidate
  const solicitorContact = contacts.find((c) => c.roleType === "solicitor" && c.email) ?? null;
  const clientContact = contacts.find((c) => ["vendor", "purchaser", "broker"].includes(c.roleType) && c.email) ?? null;

  // WhatsApp: only client contacts with phones (never solicitor on WhatsApp)
  const whatsappCandidates = contacts.filter((c) => ["vendor", "purchaser", "broker"].includes(c.roleType) && c.phone);
  const [selectedWaId, setSelectedWaId] = useState<string | null>(
    whatsappCandidates.length === 1 ? whatsappCandidates[0].id : null
  );
  const selectedWaContact = whatsappCandidates.find((c) => c.id === selectedWaId) ?? null;

  // Display contact in header — client first, then solicitor fallback
  const displayContact =
    contacts.find((c) => ["vendor", "purchaser", "broker"].includes(c.roleType)) ??
    contacts.find((c) => c.roleType === "solicitor") ??
    contacts[0] ?? null;

  const [channel, setChannel] = useState<Channel>("email");
  const [tone, setTone] = useState<Tone>(autoTone(nextChaseNumber));
  const [toneMenuOpen, setToneMenuOpen] = useState(false);
  const [ccSolicitor, setCcSolicitor] = useState(true);
  const [message, setMessage] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedContext, setGeneratedContext] = useState<{ primaryContact: { name: string; role: string } | null } | null>(null);

  const showCcToggle = channel === "email" && solicitorContact !== null;
  const effectiveCc = showCcToggle && ccSolicitor && solicitorContact?.email ? [solicitorContact.email] : [];
  const needsWaPick = channel === "whatsapp" && whatsappCandidates.length > 1 && !selectedWaId;

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const body = isMulti
        ? { chaseTaskIds: milestones!.map((m) => m.chaseTaskId), channel, tone, includeSolicitorCc: showCcToggle && ccSolicitor }
        : { chaseTaskId, channel, tone, includeSolicitorCc: showCcToggle && ccSolicitor };
      const res = await fetch("/api/ai/generate-chase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 429) { setError(data.message ?? "Too many requests — please wait a few minutes and try again."); return; }
      if (!res.ok) { setError(data.error ?? "Generation failed"); return; }
      setGeneratedText(data.generated);
      setMessage(data.generated);
      setGeneratedContext(data.context);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSend(): Promise<void> {
    if (!message.trim()) return;
    if (needsWaPick) { setError("Please select which contact to WhatsApp."); return; }
    setIsSending(true);
    setError(null);

    const wasAiGenerated = generatedText.length > 0;
    const wasEdited = wasAiGenerated && message !== generatedText;
    const primaryRoles = ["solicitor", "vendor", "purchaser"];
    const contactIds = contacts.filter((c) => primaryRoles.includes(c.roleType)).map((c) => c.id);
    const taskIdsToLog = isMulti ? milestones!.map((m) => m.chaseTaskId) : [chaseTaskId];

    try {
      for (const taskId of taskIdsToLog) {
        const commRes = await fetch("/api/comms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId,
            chaseTaskId: taskId,
            type: "outbound",
            method: channel,
            contactIds,
            content: message,
            generatedText: wasAiGenerated ? generatedText : undefined,
            tone,
            wasAiGenerated,
            wasEdited,
          }),
        });
        if (!commRes.ok) {
          const err = await commRes.json();
          setError(err.error ?? "Failed to log communication");
          setIsSending(false);
          return;
        }
      }

      if (channel === "email") {
        const recipient = clientContact ?? solicitorContact ?? contacts.find((c) => c.email);
        if (recipient?.email) {
          const emailRes = await fetch("/api/chase/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chaseTaskId,
              transactionId,
              toEmail: recipient.email,
              toName: recipient.name,
              messageText: message,
              ccEmails: effectiveCc,
            }),
          });
          const emailData: SendResult = await emailRes.json();
          if (!emailRes.ok) {
            const msg = emailRes.status === 429
              ? (emailData as { message?: string }).message ?? "Too many emails sent — please wait before sending more."
              : `Logged but email delivery failed: ${emailData.error ?? "unknown error"}`;
            setError(msg);
            onSent();
            onClose();
            return;
          }
        }
      }

      if (channel === "whatsapp") {
        const waContact = selectedWaContact ?? whatsappCandidates[0] ?? null;
        if (waContact?.phone) {
          const phone = waContact.phone.replace(/\D/g, "");
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
        }
      }

      onSent();
      onClose();
    } catch {
      setError("Send failed. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  const coral = "#FF6B4A";
  const coralLight = "rgba(255,107,74,0.10)";
  const coralBorder = "rgba(255,107,74,0.18)";
  const ink = "rgba(26,10,0,0.88)";
  const inkMid = "rgba(26,10,0,0.45)";
  const inkFaint = "rgba(26,10,0,0.20)";

  return createPortal(
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: 1000 }}>
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)", animation: "agent-backdrop-in 200ms ease both" }}
        onClick={onClose}
      />
      <div
        className="relative z-10 flex flex-col h-full"
        style={{
          width: "min(460px, 100vw)",
          background: "rgba(255,250,247,0.98)",
          backdropFilter: "blur(40px) saturate(1.9)",
          WebkitBackdropFilter: "blur(40px) saturate(1.9)",
          borderLeft: `0.5px solid ${coralBorder}`,
          boxShadow: `-16px 0 64px rgba(0,0,0,0.16), -1px 0 0 ${coralBorder}`,
          animation: "agent-modal-in 300ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{
          padding: "18px 20px 16px",
          background: "rgba(255,255,255,0.55)",
          borderBottom: `0.5px solid ${coralBorder}`,
          position: "relative", overflow: "hidden",
        }}>
          {/* Bloom */}
          <div aria-hidden style={{ position: "absolute", top: -40, right: -30, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${coralLight} 0%, transparent 70%)`, pointerEvents: "none" }} />

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, position: "relative" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: coral, background: coralLight, padding: "2px 7px", borderRadius: 20 }}>
                  {isMulti ? `Chase all · ${milestones!.length}` : "Chase"}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: inkFaint }}>#{nextChaseNumber}</span>
                <TonePill tone={tone} />
              </div>
              {isMulti ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {milestones!.map((m) => (
                    <p key={m.chaseTaskId} style={{ margin: 0, fontSize: 12, color: inkMid, lineHeight: 1.4 }}>· {m.name}</p>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ink, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                  {milestoneName}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ padding: 6, borderRadius: 8, border: `0.5px solid ${inkFaint}`, background: "rgba(255,255,255,0.60)", cursor: "pointer", color: inkMid, display: "flex", flexShrink: 0, transition: "background 120ms" }}
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        </div>

        {/* ── Property + contact card ─────────────────────────────── */}
        <div style={{ padding: "12px 20px", borderBottom: `0.5px solid ${inkFaint}` }}>
          <div style={{
            background: "rgba(255,255,255,0.75)", border: `0.5px solid ${coralBorder}`,
            borderRadius: 14, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: `0 2px 12px ${coralLight}`,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${coralLight}, rgba(255,107,74,0.04))`,
              border: `0.5px solid ${coralBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
            }}>🏠</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                {propertyAddress}
              </p>
              {displayContact && (
                <p style={{ margin: "2px 0 0", fontSize: 11, color: inkMid, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: coralLight, border: `0.5px solid ${coralBorder}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: coral, flexShrink: 0 }}>
                    {initials(displayContact.name)}
                  </span>
                  {displayContact.name}
                  <span style={{ color: inkFaint, textTransform: "capitalize" }}>· {displayContact.roleType}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable config + message area ───────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Channel selector */}
          <div style={{ padding: "14px 20px 12px", borderBottom: `0.5px solid ${inkFaint}` }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: inkMid }}>Send via</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {/* Email tab */}
              <button
                onClick={() => setChannel("email")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                  border: channel === "email" ? `1.5px solid ${coral}` : `0.5px solid ${inkFaint}`,
                  background: channel === "email" ? `linear-gradient(135deg, ${coral}, #FF8F6B)` : "rgba(255,255,255,0.60)",
                  color: channel === "email" ? "white" : inkMid,
                  cursor: "pointer", transition: "all 150ms",
                  boxShadow: channel === "email" ? `0 4px 16px rgba(255,107,74,0.28)` : "none",
                }}
              >
                <EnvelopeSimple size={15} weight={channel === "email" ? "fill" : "regular"} /> Email
              </button>
              {/* WhatsApp tab */}
              <button
                onClick={() => setChannel("whatsapp")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                  border: channel === "whatsapp" ? "1.5px solid #22c55e" : `0.5px solid ${inkFaint}`,
                  background: channel === "whatsapp" ? "linear-gradient(135deg, #22c55e, #4ade80)" : "rgba(255,255,255,0.60)",
                  color: channel === "whatsapp" ? "white" : inkMid,
                  cursor: "pointer", transition: "all 150ms",
                  boxShadow: channel === "whatsapp" ? "0 4px 16px rgba(34,197,94,0.25)" : "none",
                }}
              >
                <ChatText size={15} weight={channel === "whatsapp" ? "fill" : "regular"} /> WhatsApp
              </button>
            </div>

            {/* CC toggle — email + solicitor with email only */}
            {showCcToggle && (
              <button
                onClick={() => setCcSolicitor((v) => !v)}
                style={{
                  marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 10, border: `0.5px solid ${ccSolicitor ? coralBorder : inkFaint}`,
                  background: ccSolicitor ? "rgba(255,107,74,0.05)" : "rgba(255,255,255,0.40)",
                  cursor: "pointer", transition: "all 140ms",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: ccSolicitor ? coral : inkMid }}>
                  CC {solicitorContact!.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>(solicitor)</span>
                </span>
                <span style={{
                  width: 34, height: 18, borderRadius: 9, display: "flex", alignItems: "center",
                  background: ccSolicitor ? coral : inkFaint, transition: "background 140ms", flexShrink: 0,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: "50%", background: "white",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.20)",
                    marginLeft: ccSolicitor ? 16 : 2, transition: "margin-left 140ms",
                  }} />
                </span>
              </button>
            )}

            {/* WhatsApp contact picker — when multiple clients have phones */}
            {channel === "whatsapp" && whatsappCandidates.length > 1 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: inkMid }}>
                  Send to
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {whatsappCandidates.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedWaId(c.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", borderRadius: 10, textAlign: "left",
                        border: selectedWaId === c.id ? "1.5px solid #22c55e" : `0.5px solid ${inkFaint}`,
                        background: selectedWaId === c.id ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.50)",
                        cursor: "pointer", transition: "all 140ms",
                      }}
                    >
                      <span style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: selectedWaId === c.id ? "rgba(34,197,94,0.15)" : "rgba(26,10,0,0.06)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: selectedWaId === c.id ? "#16a34a" : inkMid,
                      }}>
                        {initials(c.name)}
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: ink }}>{c.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: inkMid, textTransform: "capitalize" }}>{c.roleType} · {c.phone}</p>
                      </div>
                      {selectedWaId === c.id && (
                        <span style={{ marginLeft: "auto", fontSize: 14, color: "#16a34a" }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tone selector */}
          <div style={{ padding: "12px 20px", borderBottom: `0.5px solid ${inkFaint}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: inkMid }}>Tone</p>
              <span style={{ fontSize: 10, color: inkFaint }}>Auto-selected · override if needed</span>
            </div>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setToneMenuOpen((v) => !v)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 10, border: `0.5px solid ${inkFaint}`,
                  background: "rgba(255,255,255,0.65)", cursor: "pointer", transition: "border-color 140ms",
                }}
              >
                <TonePill tone={tone} />
                <span style={{ color: inkMid, display: "flex" }}>
                  {toneMenuOpen ? <CaretUp size={13} /> : <CaretDown size={13} />}
                </span>
              </button>
              {toneMenuOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
                  background: "rgba(255,251,248,0.98)", backdropFilter: "blur(20px)",
                  borderRadius: 12, border: `0.5px solid ${inkFaint}`,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden",
                }}>
                  {TONES.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTone(t); setToneMenuOpen(false); }}
                      style={{
                        width: "100%", textAlign: "left", padding: "9px 12px",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: tone === t ? coralLight : "transparent",
                        border: "none", cursor: "pointer", transition: "background 100ms",
                      }}
                    >
                      <TonePill tone={t} />
                      {t === autoTone(nextChaseNumber) && (
                        <span style={{ fontSize: 10, color: inkFaint }}>Recommended</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Message area */}
          <div style={{ flex: 1, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "11px 0", borderRadius: 12,
                background: isGenerating ? "rgba(255,107,74,0.40)" : `linear-gradient(135deg, ${coral} 0%, #FF8F6B 100%)`,
                border: "none", color: "white", fontSize: 13, fontWeight: 700,
                cursor: isGenerating ? "not-allowed" : "pointer",
                boxShadow: isGenerating ? "none" : "0 4px 20px rgba(255,107,74,0.32)",
                transition: "all 160ms", letterSpacing: "0.01em",
              }}
            >
              {isGenerating
                ? <><CircleNotch size={15} className="animate-spin" />Generating…</>
                : <><Sparkle size={15} weight="fill" />Generate message</>}
            </button>

            {generatedContext?.primaryContact && (
              <p style={{ margin: 0, fontSize: 11, color: inkMid, textAlign: "center" }}>
                Drafted for <span style={{ fontWeight: 600, color: ink }}>{generatedContext.primaryContact.name}</span>
                <span style={{ color: inkFaint }}> ({generatedContext.primaryContact.role})</span>
              </p>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={channel === "email" ? "Generate a message above, or type your own…" : "Generate a WhatsApp message above, or type your own…"}
              rows={11}
              style={{
                width: "100%", boxSizing: "border-box", resize: "none",
                padding: "12px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                border: `0.5px solid ${inkFaint}`, outline: "none",
                background: "rgba(255,255,255,0.75)",
                color: ink,
                fontFamily: "inherit",
                transition: "border-color 140ms",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = coralBorder)}
              onBlur={(e) => (e.currentTarget.style.borderColor = inkFaint)}
            />

            {generatedText && message !== generatedText && message.length > 0 && (
              <p style={{ margin: 0, fontSize: 11, color: inkMid, textAlign: "center" }}>✏️ Message edited from generated version</p>
            )}

            {error && (
              <div style={{ background: "#fef2f2", border: "0.5px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer / Send ───────────────────────────────────────── */}
        <div style={{
          padding: "14px 20px 18px",
          borderTop: `0.5px solid ${coralBorder}`,
          background: "rgba(255,255,255,0.55)",
        }}>
          <button
            onClick={handleSend}
            disabled={!message.trim() || isSending || needsWaPick}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "13px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
              border: "none", cursor: !message.trim() || isSending || needsWaPick ? "not-allowed" : "pointer",
              transition: "all 160ms",
              ...(channel === "whatsapp"
                ? {
                    background: !message.trim() || isSending || needsWaPick ? "rgba(34,197,94,0.35)" : "linear-gradient(135deg, #22c55e, #4ade80)",
                    color: "white",
                    boxShadow: !message.trim() || isSending || needsWaPick ? "none" : "0 4px 20px rgba(34,197,94,0.28)",
                  }
                : {
                    background: !message.trim() || isSending ? `rgba(255,107,74,0.35)` : `linear-gradient(135deg, ${coral}, #FF8F6B)`,
                    color: "white",
                    boxShadow: !message.trim() || isSending ? "none" : "0 4px 20px rgba(255,107,74,0.28)",
                  }),
            }}
          >
            {isSending
              ? <><CircleNotch size={15} className="animate-spin" />Sending…</>
              : <><PaperPlaneTilt size={15} weight="fill" />{channel === "whatsapp" ? "Open WhatsApp" : "Send chase"}</>}
          </button>

          {/* Recipient summary */}
          <p style={{ margin: "8px 0 0", fontSize: 11, color: inkMid, textAlign: "center", lineHeight: 1.5 }}>
            {channel === "whatsapp"
              ? needsWaPick
                ? "↑ Select a contact above to send"
                : `WhatsApp to ${selectedWaContact?.name ?? whatsappCandidates[0]?.name ?? "client"} · logged automatically`
              : (() => {
                  const rec = clientContact ?? solicitorContact ?? contacts.find((c) => c.email);
                  if (!rec?.email) return "No email on file — will be logged only";
                  const ccPart = effectiveCc.length ? ` · CC: ${effectiveCc[0]}` : "";
                  return `To: ${rec.email}${ccPart}`;
                })()}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
