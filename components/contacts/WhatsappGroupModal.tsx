"use client";
// components/contacts/WhatsappGroupModal.tsx
//
// Two-phase helper for setting up + using a WhatsApp group for a sale.
//
// Phase 1 — Create the group (shown when no invite URL is saved yet):
//   - Suggested group name pre-filled + one-click copy
//   - All client WhatsApp numbers in a copyable block + one-click copy
//   - "Open WhatsApp" button (whatsapp:// on mobile, web.whatsapp.com on desktop)
//   - Input for the invite URL once the group is created
//   - Save button persists the URL via setWhatsappGroupInviteUrlAction
//
// Phase 2 — Invite clients (shown when the URL is saved):
//   - Group status + link with "Open group" and "Copy link"
//   - For each contact with a phone number: one-tap "Send invite via
//     WhatsApp" button that opens a pre-composed message
//   - "Replace link" / "Remove link" secondary actions
//
// Not for solicitor / broker / other roles — buttons filter to vendor +
// purchaser contacts, matching the existing portal-invite policy.

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  setWhatsappGroupInviteUrlAction,
  removeWhatsappGroupInviteUrlAction,
} from "@/app/actions/property-extras";
import { WhatsappLogo, Copy, ArrowSquareOut, Trash, PencilSimple } from "@phosphor-icons/react";

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  roleType: string;
};

// Normalise a UK phone into wa.me / group-message format (no leading zeros,
// no spaces, no punctuation, starts with country code).
function toWaDigits(phone: string): string {
  let digits = phone.replace(/[\s\-().+]/g, "");
  if (digits.startsWith("07")) digits = "44" + digits.slice(1);
  else if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  return digits;
}

// Short property name for the group title. "1 The Kiplings, Gooseberry Hill,
// Luton, LU3 2LA" → "1 The Kiplings".
function shortAddress(address: string): string {
  return address.split(",")[0]?.trim() || address;
}

export function WhatsappGroupModal({
  open,
  onClose,
  transactionId,
  address,
  contacts,
  currentInviteUrl,
}: {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  address: string;
  contacts: Contact[];
  currentInviteUrl: string | null;
}) {
  const { toast } = useAgentToast();
  const [linkInput, setLinkInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const clientContacts = contacts.filter(
    (c) => (c.roleType === "vendor" || c.roleType === "purchaser") && c.phone,
  );

  const suggestedName = `Sale of ${shortAddress(address)}`;
  const numbersBlock = clientContacts
    .map((c) => `+${toWaDigits(c.phone!)}`)
    .join("\n");

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1600);
    });
  }

  function openWhatsApp() {
    // Try the app scheme first; fall back to web. Browsers ignore the
    // unknown scheme silently, so we open web.whatsapp.com in parallel.
    // On mobile the app handler fires; on desktop the app URL is a no-op
    // and the user lands on web.whatsapp.com.
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = "whatsapp://";
    } else {
      window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
    }
  }

  async function saveLink() {
    setError(null);
    setSaving(true);
    try {
      await setWhatsappGroupInviteUrlAction(transactionId, linkInput);
      toast.success("Group link saved", { description: "You can now send WhatsApp invites to clients" });
      setLinkInput("");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save link");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink() {
    setSaving(true);
    try {
      await removeWhatsappGroupInviteUrlAction(transactionId);
      toast.success("Group link removed");
    } finally {
      setSaving(false);
    }
  }

  function inviteViaWhatsApp(contact: Contact) {
    if (!contact.phone || !currentInviteUrl) return;
    const digits = toWaDigits(contact.phone);
    const firstName = contact.name.trim().split(/\s+/).filter((w) => !/^(mr|mrs|ms|miss|mx|dr)\.?$/i.test(w))[0] ?? contact.name;
    const msg = `Hi ${firstName}, I've set up a WhatsApp group for your sale at ${shortAddress(address)}. Join here: ${currentInviteUrl}`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Show Phase 2 (invite flow) when a link is saved AND the agent hasn't
  // clicked "Replace link". Otherwise show Phase 1 (create-group helper).
  const showInviteFlow = !!currentInviteUrl && !editing;

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel="WhatsApp group helper">
      <Modal.Header>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 9,
              background: "rgba(37,211,102,0.12)", color: "#25D366",
            }}
          >
            <WhatsappLogo size={20} weight="fill" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              WhatsApp group
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>
              {shortAddress(address)}
            </p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {clientContacts.length === 0 && (
          <div
            style={{
              padding: 14, borderRadius: 10,
              background: "rgba(217,119,6,0.08)",
              border: "0.5px solid rgba(217,119,6,0.25)",
              fontSize: 13, color: "var(--agent-text-primary)",
            }}
          >
            No vendor or purchaser contacts have a phone number on file yet. Add phone numbers to the client contacts first, then come back here.
          </div>
        )}

        {/* ── PHASE 2: invite flow ──────────────────────────── */}
        {showInviteFlow && clientContacts.length > 0 && (
          <>
            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={sectionLabelStyle}>Group set up</span>
                  <a
                    href={currentInviteUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "var(--agent-text-secondary)", textDecoration: "underline", wordBreak: "break-all" }}
                  >
                    {currentInviteUrl}
                  </a>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => copy(currentInviteUrl!, "current-link")}
                    className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                    title="Copy group link"
                  >
                    {copiedKey === "current-link" ? "✓" : <Copy size={12} />}
                  </button>
                  <a
                    href={currentInviteUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <ArrowSquareOut size={12} /> Open
                  </a>
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <span style={sectionLabelStyle}>Send invite to each client</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {clientContacts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 10px", borderRadius: 8,
                      border: "0.5px solid var(--agent-border-default)",
                      background: "var(--agent-surface-elevated)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{c.phone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => inviteViaWhatsApp(c)}
                      className="agent-btn agent-btn-xs"
                      style={{
                        background: "#25D366", color: "white", borderColor: "#25D366",
                        display: "inline-flex", alignItems: "center", gap: 5,
                      }}
                    >
                      <WhatsappLogo size={12} weight="fill" />
                      Send invite
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => { setEditing(true); setLinkInput(currentInviteUrl ?? ""); }}
                className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <PencilSimple size={12} /> Replace link
              </button>
              <button
                type="button"
                onClick={removeLink}
                disabled={saving}
                className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                style={{ color: "var(--agent-danger)", display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <Trash size={12} /> Remove link
              </button>
            </div>
          </>
        )}

        {/* ── PHASE 1: create-group helper ──────────────────── */}
        {(!showInviteFlow || editing) && clientContacts.length > 0 && (
          <>
            <div style={sectionStyle}>
              <span style={sectionLabelStyle}>1. Group name</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <input
                  readOnly
                  value={suggestedName}
                  className="glass-input"
                  style={{ flex: 1, padding: "9px 12px", fontSize: 13 }}
                />
                <button
                  type="button"
                  onClick={() => copy(suggestedName, "name")}
                  className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}
                >
                  <Copy size={13} />
                  {copiedKey === "name" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={sectionLabelStyle}>2. Numbers to add ({clientContacts.length})</span>
                <button
                  type="button"
                  onClick={() => copy(numbersBlock, "numbers")}
                  className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  <Copy size={13} />
                  {copiedKey === "numbers" ? "Copied" : "Copy all"}
                </button>
              </div>
              <pre
                style={{
                  margin: "8px 0 0", padding: "10px 12px",
                  borderRadius: 8, border: "0.5px solid var(--agent-border-default)",
                  background: "var(--agent-surface-elevated)",
                  fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: "var(--agent-text-secondary)", whiteSpace: "pre-wrap",
                }}
              >
                {numbersBlock || "(no phone numbers on file)"}
              </pre>
            </div>

            <div style={sectionStyle}>
              <span style={sectionLabelStyle}>3. Create the group</span>
              <p style={{ margin: "6px 0 8px", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                In WhatsApp: New group → paste the numbers above → paste the group name. Add a group photo if you have one uploaded on the file.
              </p>
              <button
                type="button"
                onClick={openWhatsApp}
                className="agent-btn agent-btn-sm"
                style={{
                  background: "#25D366", color: "white", borderColor: "#25D366",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <WhatsappLogo size={14} weight="fill" />
                Open WhatsApp
              </button>
            </div>

            <div style={sectionStyle}>
              <span style={sectionLabelStyle}>4. Paste the invite link here when the group is set up</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <input
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://chat.whatsapp.com/…"
                  className="glass-input"
                  style={{ flex: 1, padding: "9px 12px", fontSize: 13 }}
                />
                <button
                  type="button"
                  onClick={saveLink}
                  disabled={saving || !linkInput.trim()}
                  className="agent-btn agent-btn-sm agent-btn-primary"
                >
                  {saving ? "Saving…" : "Save link"}
                </button>
              </div>
              {error && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--agent-danger)" }}>{error}</p>
              )}
              {editing && (
                <button
                  type="button"
                  onClick={() => { setEditing(false); setLinkInput(""); setError(null); }}
                  className="agent-link"
                  style={{ marginTop: 8, fontSize: 12 }}
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
        >
          Close
        </button>
      </Modal.Footer>
    </Modal>
  );
}

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--agent-text-muted)",
};
