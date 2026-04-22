"use client";

import { useState } from "react";
import { X, Mail, MessageSquare, Sparkles, Send, Loader2, ChevronDown } from "lucide-react";

type Channel = "email" | "whatsapp";
type Tone = "Friendly" | "Professional" | "Polite Yet Firm" | "Chase Up" | "Urgent" | "Final Reminder";

const TONES: Tone[] = ["Friendly", "Professional", "Polite Yet Firm", "Chase Up", "Urgent", "Final Reminder"];

function autoTone(chaseCount: number): Tone {
  const map: Tone[] = ["Friendly", "Professional", "Polite Yet Firm", "Chase Up", "Urgent", "Final Reminder"];
  return map[Math.min(chaseCount - 1, map.length - 1)] ?? "Friendly";
}

const TONE_COLOURS: Record<Tone, string> = {
  Friendly: "bg-green-100 text-green-700",
  Professional: "bg-blue-100 text-blue-700",
  "Polite Yet Firm": "bg-yellow-100 text-yellow-700",
  "Chase Up": "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
  "Final Reminder": "bg-red-200 text-red-800",
};

interface ChaseDrawerProps {
  chaseTaskId: string;
  transactionId: string;
  propertyAddress: string;
  milestoneName: string;
  chaseCount: number;
  contacts: Array<{ id: string; name: string; roleType: string; email?: string | null; phone?: string | null }>;
  onClose: () => void;
  onSent: () => void;
}

type SendResult = { ok: boolean; emailSent?: boolean; error?: string };

export function ChaseDrawer({
  chaseTaskId,
  transactionId,
  propertyAddress,
  milestoneName,
  chaseCount,
  contacts,
  onClose,
  onSent,
}: ChaseDrawerProps) {
  const nextChaseNumber = chaseCount + 1;
  const [channel, setChannel] = useState<Channel>("email");
  const [tone, setTone] = useState<Tone>(autoTone(nextChaseNumber));
  const [toneMenuOpen, setToneMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedContext, setGeneratedContext] = useState<{ primaryContact: { name: string; role: string } | null } | null>(null);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-chase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chaseTaskId, channel, tone }),
      });
      const data = await res.json();
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
    setIsSending(true);
    setError(null);

    const wasAiGenerated = generatedText.length > 0;
    const wasEdited = wasAiGenerated && message !== generatedText;
    const primaryRoles = ["solicitor", "vendor", "purchaser"];
    const contactIds = contacts.filter((c) => primaryRoles.includes(c.roleType)).map((c) => c.id);

    try {
      const commRes = await fetch("/api/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId,
          chaseTaskId,
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
        return;
      }

      if (channel === "email") {
        const recipient =
          contacts.find((c) => c.roleType === "solicitor" && c.email) ??
          contacts.find((c) => ["vendor", "purchaser"].includes(c.roleType) && c.email) ??
          contacts.find((c) => c.email);

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
            }),
          });
          const emailData: SendResult = await emailRes.json();
          if (!emailRes.ok) {
            setError(`Logged but email delivery failed: ${emailData.error ?? "unknown error"}`);
            onSent();
            onClose();
            return;
          }
        }
      }

      if (channel === "whatsapp") {
        const primaryContact = contacts.find((c) =>
          ["solicitor", "vendor", "purchaser"].includes(c.roleType)
        );
        if (primaryContact?.phone) {
          const phone = primaryContact.phone.replace(/\D/g, "");
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

  const displayContact =
    contacts.find((c) => c.roleType === "solicitor") ??
    contacts.find((c) => c.roleType === "vendor") ??
    contacts.find((c) => c.roleType === "purchaser") ??
    contacts[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md flex flex-col h-full"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(32px) saturate(1.8)",
          WebkitBackdropFilter: "blur(32px) saturate(1.8)",
          borderLeft: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.20)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/40 bg-white/20">
          <div>
            <h2 className="text-sm font-semibold text-slate-900/90">Chase</h2>
            <p className="text-xs text-slate-900/40 mt-0.5 truncate max-w-[280px]">{milestoneName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/30 text-slate-900/40 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Property info */}
        <div className="px-5 py-3 border-b border-white/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 text-xs">🏠</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900/90">{propertyAddress}</p>
              {displayContact && (
                <p className="text-xs text-slate-900/50 capitalize">{displayContact.name} · {displayContact.roleType}</p>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-900/40">Chase #{nextChaseNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TONE_COLOURS[tone]}`}>
              {tone}
            </span>
          </div>
        </div>

        {/* Channel selector */}
        <div className="px-5 py-3 border-b border-white/30">
          <p className="text-xs font-medium text-slate-900/50 mb-2">Send via</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setChannel("email")}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                channel === "email"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white/30 text-slate-900/70 border-white/30 hover:border-blue-400"
              }`}
            >
              <Mail size={14} /> Email
            </button>
            <button
              onClick={() => setChannel("whatsapp")}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                channel === "whatsapp"
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-white/30 text-slate-900/70 border-white/30 hover:border-green-500"
              }`}
            >
              <MessageSquare size={14} /> WhatsApp
            </button>
          </div>
        </div>

        {/* Tone selector */}
        <div className="px-5 py-3 border-b border-white/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-900/50">Tone</p>
            <span className="text-xs text-slate-900/30">Auto-selected · override if needed</span>
          </div>
          <div className="relative">
            <button
              onClick={() => setToneMenuOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-white/30 bg-white/40 text-sm text-slate-900/80 hover:border-blue-400 transition-colors"
            >
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TONE_COLOURS[tone]}`}>{tone}</span>
              <ChevronDown size={14} className="text-slate-900/40" />
            </button>
            {toneMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl shadow-lg z-10 overflow-hidden">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTone(t); setToneMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/40 transition-colors ${tone === t ? "bg-blue-50/60" : ""}`}
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TONE_COLOURS[t]}`}>{t}</span>
                    {t === autoTone(nextChaseNumber) && (
                      <span className="text-xs text-slate-900/30 ml-auto">Recommended</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message area */}
        <div className="flex-1 px-5 py-3 flex flex-col gap-3 overflow-y-auto">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {isGenerating
              ? <><Loader2 size={14} className="animate-spin" />Generating...</>
              : <><Sparkles size={14} />Generate message</>}
          </button>

          {generatedContext?.primaryContact && (
            <p className="text-xs text-slate-900/40 text-center">
              Drafted for{" "}
              <span className="font-medium text-slate-900/70">{generatedContext.primaryContact.name}</span>
              {" "}({generatedContext.primaryContact.role})
            </p>
          )}

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={channel === "email" ? "Generate a message or type your own..." : "Generate a WhatsApp message or type your own..."}
            rows={12}
            className="glass-input w-full flex-1 px-3 py-2.5 text-sm resize-none"
          />

          {generatedText && message !== generatedText && message.length > 0 && (
            <p className="text-xs text-slate-900/40 text-center">✏️ Message edited from generated version</p>
          )}

          {error && (
            <div className="bg-red-50/80 border border-red-200/60 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/30 bg-white/20">
          <button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
              channel === "whatsapp"
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            {isSending
              ? <><Loader2 size={14} className="animate-spin" />Sending...</>
              : <><Send size={14} />{channel === "whatsapp" ? "Open WhatsApp" : "Send chase"}</>}
          </button>
          <p className="text-xs text-slate-900/40 text-center mt-2">
            {channel === "whatsapp"
              ? "Message is logged, then WhatsApp opens with the message ready to send"
              : (() => {
                  const rec = contacts.find((c) => c.roleType === "solicitor" && c.email) ??
                    contacts.find((c) => ["vendor","purchaser"].includes(c.roleType) && c.email) ??
                    contacts.find((c) => c.email);
                  return rec?.email
                    ? `Will be sent to ${rec.email} and logged`
                    : "Logged as outbound — no email address on file for this contact";
                })()}
          </p>
        </div>
      </div>
    </div>
  );
}
