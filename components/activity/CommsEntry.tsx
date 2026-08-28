"use client";
// components/activity/CommsEntry.tsx
// Single-panel, channel-first comm entry. No multi-step flow.

import { useState, useTransition, useRef, useEffect } from "react";
import type { CommType, CommMethod } from "@prisma/client";
import { logCommAction } from "@/app/actions/comms";
import { extractFirstName } from "@/lib/contacts/displayName";
import { ContactAvatar } from "@/components/ui/Avatar";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { PasteWhatsAppPanel, type ImportableContact } from "@/components/activity/PasteWhatsAppPanel";
import { DraftForEveryonePanel } from "@/components/activity/DraftForEveryonePanel";
import { GlassCard } from "@/components/glass/GlassCard";

type Contact = { id: string; name: string; roleType: string; phone?: string | null };
type Solicitor = { id: string; name: string; role: string; phone?: string | null };

type Props = {
  transactionId: string;
  contacts: Contact[];
  solicitors?: Solicitor[];
  /** Gates the "Paste chat" entry in the overflow menu. Internal staff only (admin / sales_progressor). */
  canPasteChat?: boolean;
  /** Optional optimistic-render callback. When supplied, fires after the
   * server action resolves successfully — the parent appends an entry to
   * the activity timeline immediately, without waiting for the server
   * revalidation round-trip. */
  onOptimisticAdd?: (
    type: CommType,
    method: CommMethod | null,
    content: string,
    contactIds: string[],
  ) => void;
};

type CommChannel = "note" | "email" | "phone" | "sms" | "whatsapp" | "voicemail" | "post";

const PRIMARY_CHANNELS: { value: CommChannel; label: string; icon: string }[] = [
  { value: "email",     label: "Email",     icon: "✉" },
  { value: "phone",     label: "Phone",     icon: "☎" },
  { value: "sms",       label: "SMS",       icon: "💬" },
  // WhatsApp removed from the composer — WhatsApp lives on its own surface,
  // captured automatically by the bridge (2026-08-22).
];

const OVERFLOW_CHANNELS: { value: CommChannel; label: string; icon: string }[] = [
  { value: "voicemail", label: "Voicemail", icon: "📱" },
  { value: "post",      label: "Post",      icon: "📮" },
];

export function CommsEntry({ transactionId, contacts, solicitors, canPasteChat = false, onOptimisticAdd }: Props) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useAgentToast();
  const [channel, setChannel]         = useState<CommChannel | null>(null);
  const [direction, setDirection]     = useState<"outbound" | "inbound">("outbound");
  const [selected, setSelected]       = useState<string[]>([]);
  const [content, setContent]         = useState("");
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [isPasteMode, setIsPasteMode] = useState(false);
  const [isDraftMode, setIsDraftMode] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Build the flat contact list passed to PasteWhatsAppPanel (clients + solicitors)
  const importableContacts: ImportableContact[] = [
    ...contacts.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      roleLabel: c.roleType === "vendor" ? "Vendor" : c.roleType === "purchaser" ? "Purchaser" : c.roleType,
    })),
    ...(solicitors ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone ?? null,
      roleLabel: s.role,
    })),
  ];

  // Close overflow on outside click
  useEffect(() => {
    if (!showOverflow) return;
    function onClickOutside(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showOverflow]);

  function selectChannel(c: CommChannel) {
    setChannel(c);
    setDirection("outbound");
    setSelected([]);
    setContent("");
    setVisibleToClient(false);
    setShowOverflow(false);
    setIsPasteMode(false);
    setIsDraftMode(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function openPasteMode() {
    setChannel(null);
    setDirection("outbound");
    setSelected([]);
    setContent("");
    setVisibleToClient(false);
    setShowOverflow(false);
    setIsPasteMode(true);
    setIsDraftMode(false);
  }

  function openDraftMode() {
    setChannel(null);
    setDirection("outbound");
    setSelected([]);
    setContent("");
    setVisibleToClient(false);
    setShowOverflow(false);
    setIsPasteMode(false);
    setIsDraftMode(true);
  }

  function toggleContact(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function cancel() {
    setChannel(null);
    setDirection("outbound");
    setSelected([]);
    setContent("");
    setVisibleToClient(false);
    setShowOverflow(false);
    setIsPasteMode(false);
    setIsDraftMode(false);
  }

  function submit() {
    if (!content.trim() || !channel) return;
    setLoading(true);
    const type = channel === "note" ? "internal_note" as const : direction === "outbound" ? "outbound" as const : "inbound" as const;
    const method = channel === "note" ? null : channel as Exclude<CommChannel, "note">;
    const snap = { type, method, contactIds: selected, content, visibleToClient };
    // Fire optimistic add BEFORE we clear the form so the new row appears
    // in the timeline at the same instant the user sees the toast.
    if (onOptimisticAdd) {
      onOptimisticAdd(type, method, content, selected);
    }
    cancel();
    startTransition(async () => {
      try {
        await logCommAction({ transactionId, ...snap });
        toast.success(type === "internal_note" ? "Note added" : "Logged");
      } finally {
        setLoading(false);
      }
    });
  }

  const isNote = channel === "note";
  const hasChannel = channel !== null;
  const allContacts = contacts.length + (solicitors?.length ?? 0);

  return (
    // Design Lab: `activity-comms-entry`. Default v22 (Iridescent) per
    // Ellis's pick set, 2026-08-09.
    <GlassCard glassId="activity-comms-entry" label="Activity · Log a communication" defaultVariant="v22" className="rounded-[12px]" style={{ position: "relative", zIndex: 30 }}>
      {/* ── Channel row ──────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          borderBottom: hasChannel ? "0.5px solid var(--agent-border-default)" : "none",
        }}
      >
        {/* Draft for everyone — type one fact, get a client message + file note */}
        <button
          onClick={openDraftMode}
          onMouseEnter={(e) => { if (!isDraftMode) { e.currentTarget.style.color = "var(--agent-coral)"; e.currentTarget.style.background = "rgba(255,107,74,0.08)"; } }}
          onMouseLeave={(e) => { if (!isDraftMode) { e.currentTarget.style.color = "var(--agent-text-muted)"; e.currentTarget.style.background = "var(--agent-surface-glass)"; } }}
          style={{
            fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 7,
            border: "none", cursor: "pointer",
            background: isDraftMode ? "rgba(255,107,74,0.14)" : "var(--agent-surface-glass)",
            color: isDraftMode ? "var(--agent-coral)" : "var(--agent-text-muted)",
            transition: "background 100ms, color 100ms",
          }}
        >
          ✨ Draft for everyone
        </button>
        <div style={{ width: 1, height: 18, background: "var(--agent-border-default)", flexShrink: 0 }} />

        {/* Note */}
        <button
          onClick={() => selectChannel("note")}
          onMouseEnter={(e) => { if (channel !== "note") { e.currentTarget.style.color = "var(--agent-text-primary)"; e.currentTarget.style.background = "rgba(15,23,42,0.06)"; } }}
          onMouseLeave={(e) => { if (channel !== "note") { e.currentTarget.style.color = "var(--agent-text-muted)"; e.currentTarget.style.background = "var(--agent-surface-glass)"; } }}
          style={{
            fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 7,
            border: "none", cursor: "pointer",
            background: channel === "note" ? "rgba(217,119,6,0.12)" : "var(--agent-surface-glass)",
            color: channel === "note" ? "#d97706" : "var(--agent-text-muted)",
            transition: "background 100ms, color 100ms",
          }}
        >
          📝 Note
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: "var(--agent-border-default)", flexShrink: 0 }} />

        {/* Primary channels */}
        {PRIMARY_CHANNELS.map((ch) => (
          <button
            key={ch.value}
            onClick={() => selectChannel(ch.value)}
            onMouseEnter={(e) => { if (channel !== ch.value) { e.currentTarget.style.color = "var(--agent-text-primary)"; e.currentTarget.style.background = "rgba(15,23,42,0.06)"; } }}
            onMouseLeave={(e) => { if (channel !== ch.value) { e.currentTarget.style.color = "var(--agent-text-muted)"; e.currentTarget.style.background = "var(--agent-surface-glass)"; } }}
            style={{
              fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 7,
              border: "none", cursor: "pointer",
              background: channel === ch.value ? "rgba(255,107,74,0.10)" : "var(--agent-surface-glass)",
              color: channel === ch.value ? "var(--agent-coral)" : "var(--agent-text-muted)",
              transition: "background 100ms, color 100ms",
            }}
          >
            {ch.icon} {ch.label}
          </button>
        ))}

        {/* Overflow */}
        <div ref={overflowRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowOverflow((v) => !v)}
            onMouseEnter={(e) => { if (channel !== "voicemail" && channel !== "post") { e.currentTarget.style.color = "var(--agent-text-primary)"; e.currentTarget.style.background = "rgba(15,23,42,0.06)"; } }}
            onMouseLeave={(e) => { if (channel !== "voicemail" && channel !== "post") { e.currentTarget.style.color = "var(--agent-text-muted)"; e.currentTarget.style.background = "var(--agent-surface-glass)"; } }}
            style={{
              fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 7,
              border: "none", cursor: "pointer",
              background: (channel === "voicemail" || channel === "post") ? "rgba(255,107,74,0.10)" : "var(--agent-surface-glass)",
              color: (channel === "voicemail" || channel === "post") ? "var(--agent-coral)" : "var(--agent-text-muted)",
              transition: "background 100ms, color 100ms",
            }}
          >
            more ▾
          </button>
          {showOverflow && (
            <div
              className="agent-dropdown-in"
              style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
                background: "var(--agent-surface-elevated)",
                border: "0.5px solid var(--agent-border-default)",
                borderRadius: 8, padding: 4, minWidth: 120,
                boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
              }}
            >
              {OVERFLOW_CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  onClick={() => selectChannel(ch.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "7px 12px", fontSize: 12, fontWeight: 500,
                    border: "none", background: "transparent", cursor: "pointer",
                    borderRadius: 5, color: "var(--agent-text-primary)",
                    transition: "background 80ms",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--agent-surface-glass)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {ch.icon} {ch.label}
                </button>
              ))}
              {canPasteChat && (
                <>
                  <div style={{ height: 1, background: "var(--agent-border-subtle)", margin: "4px 6px" }} />
                  <button
                    onClick={openPasteMode}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "7px 12px", fontSize: 12, fontWeight: 500,
                      border: "none", background: "transparent", cursor: "pointer",
                      borderRadius: 5, color: "var(--agent-text-primary)",
                      transition: "background 80ms",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--agent-surface-glass)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    📋 Paste chat
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Cancel */}
        {(hasChannel || isPasteMode) && (
          <button
            onClick={cancel}
            className="agent-link agent-link-muted"
            style={{ marginLeft: "auto", fontSize: 11 }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* ── Paste WhatsApp panel — replaces standard body when active ────── */}
      {isPasteMode && (
        <PasteWhatsAppPanel
          transactionId={transactionId}
          contacts={importableContacts}
          onClose={cancel}
        />
      )}

      {/* ── Draft-for-everyone panel — replaces standard body when active ── */}
      {isDraftMode && (
        <DraftForEveryonePanel
          transactionId={transactionId}
          contacts={contacts}
          onClose={cancel}
        />
      )}

      {/* ── Expanded body — visible when channel is selected ─────────────── */}
      {hasChannel && (
        <div className="agent-reveal-in" style={{ padding: "12px 14px" }}>

          {/* Direction toggle (non-note only) */}
          {!isNote && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>Direction:</span>
              <button
                onClick={() => setDirection("outbound")}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                  border: "none", cursor: "pointer",
                  background: direction === "outbound" ? "rgba(255,107,74,0.12)" : "var(--agent-surface-glass)",
                  color: direction === "outbound" ? "var(--agent-coral)" : "var(--agent-text-muted)",
                  transition: "background 100ms, color 100ms",
                }}
              >
                Outbound (sent)
              </button>
              <button
                onClick={() => setDirection("inbound")}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                  border: "none", cursor: "pointer",
                  background: direction === "inbound" ? "rgba(16,185,129,0.12)" : "var(--agent-surface-glass)",
                  color: direction === "inbound" ? "#059669" : "var(--agent-text-muted)",
                  transition: "background 100ms, color 100ms",
                }}
              >
                Inbound (received)
              </button>
            </div>
          )}

          {/* Contact pills (non-note only, when contacts present) */}
          {!isNote && allContacts > 0 && (
            <div style={{ marginBottom: 10 }}>
              {solicitors && solicitors.length > 0 && (
                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                  Clients
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {contacts.map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleContact(c.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 500,
                        background: on ? "rgba(255,107,74,0.12)" : "var(--agent-surface-glass)",
                        color: on ? "var(--agent-coral)" : "var(--agent-text-muted)",
                        transition: "background 80ms, color 80ms",
                      }}
                    >
                      <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={16} />
                      {extractFirstName(c.name)}
                    </button>
                  );
                })}
              </div>
              {solicitors && solicitors.length > 0 && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0 6px" }}>
                    Solicitors
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {solicitors.map((s) => {
                      const on = selected.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleContact(s.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "4px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                            fontSize: 12, fontWeight: 500,
                            background: on ? "rgba(255,107,74,0.12)" : "var(--agent-surface-glass)",
                            color: on ? "var(--agent-coral)" : "var(--agent-text-muted)",
                            transition: "background 80ms, color 80ms",
                          }}
                        >
                          <ContactAvatar
                            contact={{ name: s.name, roleType: s.role === "Vendor solicitor" ? "vendor" : "purchaser" }}
                            size={16}
                          />
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={isNote ? "Add an internal note…" : "What was discussed or communicated?"}
            rows={3}
            className="glass-input w-full px-3 py-2.5 text-sm resize-none"
          />

          {/* Bottom row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
            <button
              onClick={submit}
              disabled={!content.trim() || loading || isPending}
              className="agent-btn agent-btn-sm agent-btn-primary"
            >
              {loading ? "Saving…" : "Save"}
            </button>

            {!isNote && (
              <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
                <div
                  onClick={() => setVisibleToClient((v) => !v)}
                  style={{
                    position: "relative", width: 36, height: 20, borderRadius: 10,
                    flexShrink: 0, cursor: "pointer",
                    background: visibleToClient ? "#3b82f6" : "rgba(15,23,42,0.15)",
                    transition: "background 150ms",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 2, left: 2,
                    width: 16, height: 16, borderRadius: "50%",
                    background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                    transform: visibleToClient ? "translateX(16px)" : "translateX(0)",
                    transition: "transform 150ms",
                    display: "block",
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: visibleToClient ? "#3b82f6" : "var(--agent-text-muted)", transition: "color 150ms" }}>
                  {visibleToClient ? "Visible in client portal" : "Share with client"}
                </span>
              </label>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
