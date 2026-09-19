"use client";
// components/activity/CommsEntry.tsx
// Single-panel, channel-first comm entry. No multi-step flow.
//
// This is where the agent LOGS something that happened off-platform. Draft for
// everyone and Note stay out front; every channel you'd log after the fact
// (email, call, text, voicemail, post) lives behind "More", built like the
// chevron menus elsewhere — an icon each, lift on hover, icon turns coral.
// The manual "Log an email" option hides when the agent's mailbox is connected,
// because their sent mail is already ingested automatically — logging it by hand
// would just double it up. WhatsApp paste stays, for messages from outside the
// tracked chat.

import { useState, useTransition, useRef, useEffect } from "react";
import type { CommType, CommMethod } from "@prisma/client";
import { EnvelopeSimple, Phone, ChatText, Voicemail, Package, WhatsappLogo } from "@phosphor-icons/react";
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
  /** When the agent's mailbox is connected, their sent email is ingested
   * automatically — so the manual "Log an email" option is hidden (logging it
   * by hand would duplicate it). */
  emailConnected?: boolean;
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

// Everything logged after the fact, phrased as recording something that already
// happened. Rendered in the "More" menu with an icon each.
const LOG_ITEMS: { value: CommChannel; label: string; desc: string; Icon: typeof Phone }[] = [
  { value: "email",     label: "Log an email",     desc: "One you sent or received",  Icon: EnvelopeSimple },
  { value: "phone",     label: "Log a call",       desc: "A call you made or took",   Icon: Phone },
  { value: "sms",       label: "Log a text",       desc: "An SMS to a number",        Icon: ChatText },
  { value: "voicemail", label: "Log a voicemail",  desc: "A message you left",        Icon: Voicemail },
  { value: "post",      label: "Log post",         desc: "A letter sent or received", Icon: Package },
];

export function CommsEntry({ transactionId, contacts, solicitors, canPasteChat = false, emailConnected = false, onOptimisticAdd }: Props) {
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

  const logItems = LOG_ITEMS.filter((i) => !(i.value === "email" && emailConnected));

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
  const moreActive = channel === "email" || channel === "phone" || channel === "sms" || channel === "voicemail" || channel === "post";

  return (
    // Design Lab: `activity-comms-entry`. Default v22 (Iridescent) per
    // Ellis's pick set, 2026-08-09.
    <GlassCard glassId="activity-comms-entry" label="Activity · Log a communication" defaultVariant="v22" className="rounded-[12px]" style={{ position: "relative", zIndex: 30 }}>
      <style>{`
        .ce-primary { display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:600; padding:7px 13px; border-radius:9px; border:1px solid var(--agent-coral); background:var(--agent-coral); color:#fff; cursor:pointer; box-shadow:0 1px 4px rgba(224,78,44,0.30); transition:background 120ms ease, border-color 120ms ease; }
        .ce-primary:hover { background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); }
        .ce-ghost { display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:600; padding:7px 12px; border-radius:9px; border:1px solid var(--agent-border-default); background:var(--agent-surface-glass); color:var(--agent-text-secondary); cursor:pointer; transition:border-color 120ms ease, color 120ms ease; }
        .ce-ghost:hover { border-color:var(--agent-coral); color:var(--agent-text-primary); }
        .ce-ghost[data-on="true"] { border-color:var(--agent-coral-deep); color:var(--agent-coral-deep); }
        .ce-caret { font-size:9px; color:var(--agent-text-muted); transition:transform .22s cubic-bezier(.4,0,.2,1); }
        .ce-ghost[data-open="true"] .ce-caret, .ce-ghost[data-on="true"] .ce-caret { transform:rotate(180deg); }
        .ce-menu { position:absolute; top:calc(100% + 6px); left:0; z-index:100; min-width:236px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); border-radius:13px; box-shadow:0 12px 32px rgba(30,45,74,0.16); padding:7px; }
        .ce-mi { display:flex; align-items:center; gap:11px; width:100%; text-align:left; padding:8px 9px; border-radius:9px; border:none; background:none; font-family:inherit; font-size:13px; font-weight:500; color:var(--agent-text-primary); cursor:pointer; transition:background-color .14s ease, box-shadow .14s ease; }
        .ce-mi:hover { background-color:var(--agent-hover-tint); box-shadow:var(--agent-hover-lift); }
        .ce-ico { width:20px; display:grid; place-items:center; color:var(--agent-text-muted); flex-shrink:0; transition:color .14s ease; }
        .ce-mi:hover .ce-ico { color:var(--agent-coral-deep); }
        .ce-mi small { display:block; font-weight:400; font-size:11px; color:var(--agent-text-muted); margin-top:1px; }
        .ce-mi-div { height:1px; background:var(--agent-border-subtle); margin:5px 6px; }
        .ce-mi-hint { font-size:10.5px; color:var(--agent-text-muted); padding:7px 9px 3px; line-height:1.45; }
      `}</style>
      {/* ── Channel row ──────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          borderBottom: (hasChannel || isPasteMode || isDraftMode) ? "0.5px solid var(--agent-border-default)" : "none",
        }}
      >
        {/* Draft for everyone — the primary action (type one fact → client message + file note) */}
        <button onClick={openDraftMode} className="ce-primary">✨ Draft for everyone</button>

        {/* Note */}
        <button onClick={() => selectChannel("note")} className="ce-ghost" data-on={isNote}>📝 Note</button>

        {/* More — everything you log after the fact */}
        <div ref={overflowRef} style={{ position: "relative" }}>
          <button onClick={() => setShowOverflow((v) => !v)} className="ce-ghost" data-open={showOverflow} data-on={moreActive} aria-haspopup="menu" aria-expanded={showOverflow}>
            More <span className="ce-caret">▼</span>
          </button>
          {showOverflow && (
            <div className="ce-menu agent-dropdown-in" role="menu">
              {logItems.map(({ value, label, desc, Icon }) => (
                <button key={value} className="ce-mi" role="menuitem" onClick={() => selectChannel(value)}>
                  <span className="ce-ico"><Icon size={17} /></span>
                  <span>{label}<small>{desc}</small></span>
                </button>
              ))}
              {canPasteChat && (
                <>
                  <div className="ce-mi-div" />
                  <button className="ce-mi" role="menuitem" onClick={openPasteMode}>
                    <span className="ce-ico"><WhatsappLogo size={17} /></span>
                    <span>Paste a WhatsApp chat<small>From outside the tracked chat</small></span>
                  </button>
                </>
              )}
              {emailConnected && (
                <div className="ce-mi-hint">Emails you send are logged automatically from your connected mailbox.</div>
              )}
            </div>
          )}
        </div>

        {/* Cancel */}
        {(hasChannel || isPasteMode || isDraftMode) && (
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
