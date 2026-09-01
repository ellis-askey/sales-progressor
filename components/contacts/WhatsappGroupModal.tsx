"use client";
// components/contacts/WhatsappGroupModal.tsx
//
// Two-phase helper for setting up + using a WhatsApp group for a sale.
//
// Phase 1 — Create the group (numbered stepper: name → people → create →
//   connect). A Sale/Purchase toggle frames the group for the seller or the
//   buyer side: it drives the name, the title wording and which clients are
//   listed. Persistence is a single invite URL per sale (not per side).
//
// Phase 2 — Invite clients (shown once an invite URL is saved):
//   - Group status + link with "Open group" and "Copy link"
//   - Per-client one-tap "Send invite via WhatsApp"
//   - "Replace link" / "Remove link"
//
// Not for solicitor / broker / other roles — filters to vendor + purchaser
// contacts, matching the existing portal-invite policy.

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { ContactAvatar } from "@/components/ui/Avatar";
import { RoleIcon, roleLabel, asRole } from "@/components/ui/RoleIcon";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  setWhatsappGroupInviteUrlAction,
  removeWhatsappGroupInviteUrlAction,
} from "@/app/actions/property-extras";
import { WhatsappLogo, Copy, ArrowSquareOut, Trash, PencilSimple, Lock } from "@phosphor-icons/react";

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  roleType: string;
};

type Side = "sale" | "purchase";

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

// Vendor carries the brand (coral), purchaser the info blue (same mapping as
// the contact rows).
function roleTone(role: string): "brand" | "info" | "muted" {
  return role === "vendor" ? "brand" : role === "purchaser" ? "info" : "muted";
}

function RolePill({ roleType }: { roleType: string }) {
  const r = asRole(roleType) ?? "other";
  return (
    <Pill glass tone={roleTone(roleType)} size="sm" style={{ flexShrink: 0 }}>
      <RoleIcon role={r} size={11} />
      {roleLabel(r)}
    </Pill>
  );
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
  const [side, setSide] = useState<Side>("sale");
  const [linkInput, setLinkInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const clientContacts = contacts.filter(
    (c) => (c.roleType === "vendor" || c.roleType === "purchaser") && c.phone,
  );
  // Which side the group is for. The toggle picks it; the people list, the name
  // and the title all follow.
  const wantRole = side === "sale" ? "vendor" : "purchaser";
  const sideWord = side === "sale" ? "seller" : "buyer";
  const sideContacts = clientContacts.filter((c) => c.roleType === wantRole);

  const suggestedName = `${side === "sale" ? "Sale" : "Purchase"} of ${shortAddress(address)}`;
  const numbersBlock = sideContacts.map((c) => `+${toWaDigits(c.phone!)}`).join("\n");

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1600);
    });
  }

  function openWhatsApp() {
    // Try the app scheme first; fall back to web. On mobile the app handler
    // fires; on desktop the app URL is a no-op and web.whatsapp.com opens.
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: "rgba(37,211,102,0.12)", color: "#25D366",
            }}
          >
            <WhatsappLogo size={22} weight="fill" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              Set up {sideWord} WhatsApp group
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {shortAddress(address)}
            </p>
          </div>
          {/* Done moved up into the header (marginRight clears the modal's X). */}
          <button
            type="button"
            onClick={onClose}
            className="agent-btn agent-btn-sm agent-btn-primary"
            style={{ flexShrink: 0, marginRight: 28 }}
          >
            Done
          </button>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
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
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      padding: "8px 10px", borderRadius: 8,
                      border: "0.5px solid var(--agent-border-default)",
                      background: "var(--agent-surface-elevated)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={34} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          <RolePill roleType={c.roleType} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{c.phone}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => inviteViaWhatsApp(c)}
                      className="agent-btn agent-btn-xs"
                      style={{
                        background: "#25D366", color: "white", borderColor: "#25D366",
                        display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
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

        {/* ── PHASE 1: create-group helper (numbered stepper) ── */}
        {(!showInviteFlow || editing) && clientContacts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Step num="01" title="Group name">
              <SideToggle side={side} onChange={setSide} />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
            </Step>

            <Step num="02" title="People to add">
              {sideContacts.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                  No {sideWord} phone numbers on file. Add one to the {sideWord} contact first.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sideContacts.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        padding: "8px 10px", borderRadius: 8,
                        border: "0.5px solid var(--agent-border-default)",
                        background: "var(--agent-surface-elevated)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                            <RolePill roleType={c.roleType} />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{c.phone}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(`+${toWaDigits(c.phone!)}`, `num-${c.id}`)}
                        className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}
                      >
                        <Copy size={12} />
                        {copiedKey === `num-${c.id}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => copy(numbersBlock, "numbers")}
                    className="agent-link"
                    style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, marginTop: 2 }}
                  >
                    <Copy size={12} />
                    {copiedKey === "numbers" ? "Copied" : "Copy all"}
                  </button>
                </div>
              )}
            </Step>

            <Step num="03" title="Create in WhatsApp">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5, flex: 1, minWidth: 180 }}>
                  Create a new WhatsApp group, then paste in the people above.
                </p>
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="agent-btn agent-btn-sm"
                  style={{
                    background: "#25D366", color: "white", borderColor: "#25D366",
                    display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                  }}
                >
                  <WhatsappLogo size={14} weight="fill" />
                  Open WhatsApp
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "var(--agent-text-muted)" }}>
                <Lock size={12} weight="regular" />
                Opens in WhatsApp, where you&rsquo;ll create the group.
              </div>
            </Step>

            <Step num="04" title="Connect the group" last>
              <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                Paste the WhatsApp group invite link so we know which conversation belongs to this sale.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                  style={{ flexShrink: 0 }}
                >
                  {saving ? "Saving…" : "Save"}
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
            </Step>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}

// Sale / Purchase segmented toggle with a sliding highlight (the carousel
// motion). Picking a side re-frames the whole create flow.
function SideToggle({ side, onChange }: { side: Side; onChange: (s: Side) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Group side"
      style={{
        position: "relative", display: "flex",
        background: "var(--agent-surface-elevated)",
        border: "0.5px solid var(--agent-border-default)",
        borderRadius: 10, padding: 3, marginBottom: 8,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute", top: 3, bottom: 3, left: 3,
          width: "calc(50% - 3px)", borderRadius: 8,
          background: "var(--agent-coral)",
          transform: side === "sale" ? "translateX(0)" : "translateX(100%)",
          transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
      {(["sale", "purchase"] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={side === s}
          onClick={() => onChange(s)}
          style={{
            position: "relative", zIndex: 1, flex: 1,
            padding: "6px 10px", borderRadius: 8, border: "none",
            background: "transparent", cursor: "pointer",
            fontSize: 12.5, fontWeight: 600,
            color: side === s ? "#fff" : "var(--agent-text-secondary)",
            transition: "color 200ms ease",
          }}
        >
          {s === "sale" ? "Sale" : "Purchase"}
        </button>
      ))}
    </div>
  );
}

// One numbered step in the create flow: a coral circle + a dashed connector
// running down to the next step (hidden on the last).
function Step({ num, title, last = false, children }: { num: string; title: string; last?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <span
          style={{
            width: 28, height: 28, borderRadius: 999, flexShrink: 0,
            border: "1.5px solid var(--agent-coral)",
            color: "var(--agent-coral-deep)", background: "var(--agent-coral-bg-tint)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700,
          }}
        >
          {num}
        </span>
        {!last && (
          <span
            aria-hidden
            style={{ flex: 1, borderLeft: "1.5px dashed var(--agent-coral)", opacity: 0.35, margin: "4px 0", minHeight: 14 }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 22 }}>
        <h3 style={{ margin: "4px 0 10px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{title}</h3>
        {children}
      </div>
    </div>
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
