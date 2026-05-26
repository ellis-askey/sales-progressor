"use client";
// components/activity/PasteWhatsAppPanel.tsx
//
// Three-mode panel inside CommsEntry: paste → preview/map → done.
// Replaces the standard entry inputs when the user picks "Paste chat"
// from CommsEntry's "more ▾" overflow.

import { useMemo, useState, useTransition } from "react";
import {
  parseWhatsAppChat,
  type ParsedMessage,
} from "@/lib/services/comms/parse-whatsapp";
import { normalizePhone } from "@/lib/utils";
import {
  importWhatsAppChatAction,
  undoWhatsAppImportAction,
} from "@/app/actions/comms";
import { useAgentToast } from "@/components/agent/AgentToaster";

export type ImportableContact = {
  id: string;
  name: string;
  phone: string | null;
  roleLabel: string; // "Vendor" / "Purchaser" / "Vendor solicitor" / etc. — shown in dropdown
};

type Props = {
  transactionId: string;
  contacts: ImportableContact[];
  onClose: () => void; // cancel back to standard CommsEntry
};

type Mode = "paste" | "preview" | "done";

type SenderResolution =
  | { kind: "me"; recipientContactId: string | null }
  | { kind: "contact"; contactId: string }
  | { kind: "skip" }
  | { kind: "unmapped" };

function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Pull a probable WhatsApp phone-only sender out of "+44 7962 041344" form.
function looksLikePhone(s: string): boolean {
  return /^[+\d][\d\s\-()]{5,}$/.test(s.trim());
}

function normaliseForMatch(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+44")) return "0" + cleaned.slice(3);
  if (cleaned.startsWith("0044")) return "0" + cleaned.slice(4);
  return cleaned;
}

function autoMap(sender: string, contacts: ImportableContact[]): SenderResolution {
  if (looksLikePhone(sender)) {
    const target = normaliseForMatch(sender);
    for (const c of contacts) {
      if (!c.phone) continue;
      if (normaliseForMatch(c.phone) === target) {
        return { kind: "contact", contactId: c.id };
      }
      // Also try normalizePhone (the project's existing helper) for parity
      try {
        const normalised = normalizePhone(c.phone).replace(/\s/g, "");
        if (normaliseForMatch(normalised) === target) {
          return { kind: "contact", contactId: c.id };
        }
      } catch {/* ignore */}
    }
  } else {
    // Try name match — first-name-only, case-insensitive
    const senderLower = sender.toLowerCase().trim();
    const senderFirst = senderLower.split(/\s+/)[0];
    for (const c of contacts) {
      const contactFirst = c.name.toLowerCase().trim().split(/\s+/)[0];
      if (contactFirst && (senderFirst === contactFirst || senderLower === c.name.toLowerCase())) {
        return { kind: "contact", contactId: c.id };
      }
    }
  }
  return { kind: "unmapped" };
}

export function PasteWhatsAppPanel({ transactionId, contacts, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("paste");
  const [raw, setRaw] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedMessage[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, SenderResolution>>({});
  const [uniqueSenders, setUniqueSenders] = useState<string[]>([]);
  const [doneState, setDoneState] = useState<{ inserted: number; skipped: number; importBatchId: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showUndo, setShowUndo] = useState(false);
  const { toast } = useAgentToast();

  function handleParse() {
    setParseError(null);
    const result = parseWhatsAppChat(raw);
    if (result.skipped.some((s) => s.line === 0)) {
      // Format/size error from parser
      setParseError(result.skipped[0].reason);
      return;
    }
    if (result.messages.length === 0) {
      setParseError("Couldn't recognise that as a WhatsApp chat. Copy from WhatsApp → select messages → Share → Copy and paste again.");
      return;
    }
    setParsed(result.messages);
    setUniqueSenders(result.uniqueSenders);
    const initial: Record<string, SenderResolution> = {};
    for (const sender of result.uniqueSenders) {
      initial[sender] = autoMap(sender, contacts);
    }
    setResolutions(initial);
    setMode("preview");
  }

  function setResolution(sender: string, value: string) {
    let next: SenderResolution;
    if (value === "me") next = { kind: "me", recipientContactId: null };
    else if (value === "skip") next = { kind: "skip" };
    else if (value === "unmapped") next = { kind: "unmapped" };
    else next = { kind: "contact", contactId: value };
    setResolutions((prev) => ({ ...prev, [sender]: next }));
  }

  function setMeRecipient(sender: string, contactId: string) {
    setResolutions((prev) => {
      const cur = prev[sender];
      if (cur?.kind !== "me") return prev;
      return {
        ...prev,
        [sender]: { kind: "me", recipientContactId: contactId || null },
      };
    });
  }

  const allMapped = uniqueSenders.every((s) => resolutions[s]?.kind !== "unmapped");
  // Every "me" row must have a recipient selected (otherwise the timeline
  // would read just "Outbound" with no addressee). User explicitly asked
  // for this gate — outbound parsing was unhelpful before because there
  // was no way to record who the message was to.
  const allMeHaveRecipient = uniqueSenders.every((s) => {
    const r = resolutions[s];
    return r?.kind !== "me" || !!r.recipientContactId;
  });
  const willInsertCount = parsed.filter((m) => {
    const r = resolutions[m.rawSender];
    return r && r.kind !== "skip" && r.kind !== "unmapped";
  }).length;

  function handleConfirm() {
    if (!allMapped || !allMeHaveRecipient) return;
    // Build mapping in service-expected shape — pass through the recipient
    // contactId when sender is "me" so the timeline records who the
    // outbound went to.
    const mapping: Record<
      string,
      | { kind: "me"; recipientContactId?: string | null }
      | { kind: "contact"; contactId: string }
      | { kind: "skip" }
    > = {};
    for (const [sender, res] of Object.entries(resolutions)) {
      if (res.kind === "unmapped") continue;
      if (res.kind === "me") {
        mapping[sender] = { kind: "me", recipientContactId: res.recipientContactId };
      } else {
        mapping[sender] = res;
      }
    }
    startTransition(async () => {
      try {
        const result = await importWhatsAppChatAction({
          transactionId,
          messages: parsed.map((m) => ({
            rawSender: m.rawSender,
            content: m.content,
            whatsappTimestamp: m.whatsappTimestamp,
          })),
          mapping,
        });
        setDoneState(result);
        setMode("done");
        if (result.inserted > 0 && result.importBatchId) {
          setShowUndo(true);
          // Hide the undo affordance after 5s (server still honours up to 10 min)
          setTimeout(() => setShowUndo(false), 5000);
        }
        toast.success(
          result.inserted === 0
            ? `Nothing new to log (${result.skipped} already on file)`
            : `${result.inserted} logged${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  function handleUndo() {
    if (!doneState?.importBatchId) return;
    startTransition(async () => {
      try {
        const res = await undoWhatsAppImportAction(doneState.importBatchId, transactionId);
        toast.success(`Undone — ${res.deleted} removed`);
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Undo failed");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (mode === "paste") {
    return (
      <div className="agent-reveal-in" style={{ padding: "12px 14px" }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>
          Paste a WhatsApp chat
        </p>
        <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
          Open WhatsApp → select messages → <strong>Share</strong> → <strong>Copy</strong>, then paste here. We'll parse each message and let you confirm before logging.
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="[10:30, 21/05/2026] +44 7962 041344: Survey done and dusted.&#10;[10:30, 21/05/2026] Sales Progression: Blimey that was quick!&#10;…"
          rows={10}
          className="glass-input w-full px-3 py-2.5 resize-none"
          style={{ fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        />
        {parseError && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--agent-danger)" }}>{parseError}</p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={handleParse}
            disabled={!raw.trim()}
            className="agent-btn agent-btn-sm agent-btn-primary"
          >
            Parse
          </button>
          <button onClick={onClose} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "preview") {
    return (
      <div className="agent-reveal-in" style={{ padding: "12px 14px" }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>
          Map senders — {parsed.length} message{parsed.length === 1 ? "" : "s"} parsed
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
          Tell us who each sender is. Pick a contact for inbound replies, or "Me (outbound)" if it's you. Anything already on file will be skipped.
        </p>

        {/* Sender mapping rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {uniqueSenders.map((sender) => {
            const res = resolutions[sender];
            const isUnmapped = res?.kind === "unmapped";
            const isMe = res?.kind === "me";
            const meNeedsRecipient = isMe && !res.recipientContactId;
            const currentValue =
              res?.kind === "me" ? "me" :
              res?.kind === "skip" ? "skip" :
              res?.kind === "contact" ? res.contactId :
              "unmapped";
            const flagged = isUnmapped || meNeedsRecipient;
            return (
              <div
                key={sender}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 6,
                  background: flagged ? "rgba(239,68,68,0.06)" : "var(--agent-surface-glass)",
                  border: flagged ? "0.5px solid rgba(239,68,68,0.30)" : "0.5px solid var(--agent-border-default)",
                  flexWrap: "wrap",
                }}
              >
                {flagged && (
                  <span style={{
                    display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                    background: "var(--agent-danger)", flexShrink: 0,
                  }} />
                )}
                <span style={{
                  fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)",
                  flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {sender}
                </span>
                <select
                  value={currentValue}
                  onChange={(e) => setResolution(sender, e.target.value)}
                  className="glass-input"
                  style={{ fontSize: 12, padding: "4px 8px", minWidth: 200 }}
                >
                  {isUnmapped && <option value="unmapped">— pick one —</option>}
                  <option value="me">Me (outbound)</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.roleLabel.toLowerCase()})
                    </option>
                  ))}
                  <option value="skip">Skip these messages</option>
                </select>
                {isMe && (
                  <>
                    <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>sent to</span>
                    <select
                      value={res.recipientContactId ?? ""}
                      onChange={(e) => setMeRecipient(sender, e.target.value)}
                      className="glass-input"
                      style={{ fontSize: 12, padding: "4px 8px", minWidth: 200 }}
                    >
                      <option value="">— pick recipient —</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.roleLabel.toLowerCase()})
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Parsed messages preview */}
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Preview
        </p>
        <div style={{
          maxHeight: 280, overflowY: "auto", marginBottom: 12,
          border: "0.5px solid var(--agent-border-default)", borderRadius: 6,
        }}>
          {parsed.map((m, i) => {
            const res = resolutions[m.rawSender];
            const willSkip = !res || res.kind === "skip" || res.kind === "unmapped";
            const tag =
              !res || res.kind === "unmapped" ? "needs mapping" :
              res.kind === "skip" ? "skip" :
              res.kind === "me"
                ? (res.recipientContactId
                    ? `outbound to ${contacts.find((c) => c.id === res.recipientContactId)?.name ?? "?"}`
                    : "outbound (pick recipient)")
                : `inbound from ${contacts.find((c) => c.id === res.contactId)?.name ?? "?"}`;
            return (
              <div
                key={i}
                style={{
                  display: "flex", gap: 10, padding: "7px 10px",
                  borderBottom: i < parsed.length - 1 ? "0.5px solid var(--agent-border-subtle)" : "none",
                  opacity: willSkip ? 0.5 : 1,
                  fontSize: 11,
                }}
              >
                <span style={{ color: "var(--agent-text-muted)", flexShrink: 0, minWidth: 100 }}>
                  {fmtDateTime(m.whatsappTimestamp)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 1px", fontWeight: 500, color: "var(--agent-text-primary)" }}>
                    {m.rawSender}{" "}
                    <span style={{ fontSize: 10, fontWeight: 400, color: willSkip ? "var(--agent-danger)" : "var(--agent-text-muted)" }}>
                      · {tag}
                    </span>
                  </p>
                  <p style={{ margin: 0, color: "var(--agent-text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                    {m.content.length > 120 ? m.content.slice(0, 117) + "…" : m.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleConfirm}
            disabled={!allMapped || !allMeHaveRecipient || willInsertCount === 0 || isPending}
            className="agent-btn agent-btn-sm agent-btn-primary"
          >
            {isPending ? "Logging…" : `Confirm and log (${willInsertCount})`}
          </button>
          <button
            onClick={() => setMode("paste")}
            className="agent-link agent-link-muted"
            style={{ fontSize: 11 }}
          >
            Back to paste
          </button>
          <button onClick={onClose} className="agent-link agent-link-muted" style={{ fontSize: 11, marginLeft: "auto" }}>
            Cancel
          </button>
        </div>
        {!allMapped && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--agent-danger)" }}>
            Map every sender (red rows) before confirming.
          </p>
        )}
        {allMapped && !allMeHaveRecipient && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--agent-danger)" }}>
            Pick a recipient for every &ldquo;Me (outbound)&rdquo; sender — the timeline needs to know who you sent the message to.
          </p>
        )}
      </div>
    );
  }

  // mode === "done"
  return (
    <div className="agent-reveal-in" style={{ padding: "14px" }}>
      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
        {doneState?.inserted === 0
          ? "Nothing new to log"
          : `${doneState?.inserted} message${doneState?.inserted === 1 ? "" : "s"} logged`}
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--agent-text-muted)" }}>
        {doneState && doneState.skipped > 0 && `${doneState.skipped} already on file (skipped). `}
        They'll appear in chronological position on the activity timeline.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        {showUndo && doneState?.inserted ? (
          <button
            onClick={handleUndo}
            disabled={isPending}
            className="agent-btn agent-btn-sm"
            style={{ background: "var(--agent-danger-bg)", color: "var(--agent-danger)" }}
          >
            {isPending ? "Undoing…" : "Undo"}
          </button>
        ) : null}
        <button onClick={onClose} className="agent-btn agent-btn-sm">
          Done
        </button>
      </div>
    </div>
  );
}
