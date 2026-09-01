"use client";
// components/contacts/WhatsappGroupModal.tsx
//
// Two-phase helper for setting up + using a WhatsApp group for a sale.
// Rebuilt to the approved mock 2026-09-02: green brand square + side pill +
// house sketch in the header, numbered stepper, outlined "Open WhatsApp",
// shield footer with a Done action, and a sheen that sweeps the step number
// when its Copy / Copy all / Open WhatsApp is pressed.
//
// Phase 1 — Create the group (name → people → create → connect). The header
//   "Seller / Buyer" pill switches the side: it drives the name, the title and
//   which clients are listed. Persistence is one invite URL per sale.
//
// Phase 2 — Invite clients (once an invite URL is saved): group status + link,
//   per-client "Send invite via WhatsApp", replace / remove link.
//
// Not for solicitor / broker / other roles — filters to vendor + purchaser.

import { useState, type ReactNode, type CSSProperties } from "react";
import { Modal } from "@/components/ui/Modal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  setWhatsappGroupInviteUrlAction,
  removeWhatsappGroupInviteUrlAction,
} from "@/app/actions/property-extras";
import { WhatsappLogo, Copy, ArrowSquareOut, Trash, PencilSimple, Lock, ShieldCheck, User, CaretDown } from "@phosphor-icons/react";

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  roleType: string;
};

type Side = "sale" | "purchase";

// Normalise a UK phone into wa.me / group-message format.
function toWaDigits(phone: string): string {
  let digits = phone.replace(/[\s\-().+]/g, "");
  if (digits.startsWith("07")) digits = "44" + digits.slice(1);
  else if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  return digits;
}

// Short property name for the group title.
function shortAddress(address: string): string {
  return address.split(",")[0]?.trim() || address;
}

// Friendly client label — "Seller" / "Buyer", never the raw enum.
function friendlyRole(roleType: string): string {
  return roleType === "vendor" ? "Seller" : roleType === "purchaser" ? "Buyer" : "Contact";
}

// Faint house line-drawing that bleeds off the top-right of the header.
function HouseSketch() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 180 140"
      style={{ position: "absolute", top: -14, right: -6, width: 172, height: 132, opacity: 0.5, pointerEvents: "none" }}
    >
      <g fill="none" stroke="var(--agent-coral)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.55}>
        <path d="M14 74 L90 20 L166 74" />
        <path d="M28 66 L28 126 L152 126 L152 66" />
        <rect x={120} y={30} width={14} height={26} />
        <rect x={44} y={92} width={26} height={34} />
        <rect x={92} y={80} width={34} height={26} />
        <path d="M109 80 L109 106 M92 93 L126 93" />
        <path d="M57 92 L57 126" />
      </g>
    </svg>
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
  // Which step number is mid-sheen. Set on a Copy / Copy all / Open WhatsApp
  // press, cleared after the sweep so it can re-fire on the next press.
  const [sheenStep, setSheenStep] = useState<string | null>(null);

  const clientContacts = contacts.filter(
    (c) => (c.roleType === "vendor" || c.roleType === "purchaser") && c.phone,
  );
  const wantRole = side === "sale" ? "vendor" : "purchaser";
  const sideWord = side === "sale" ? "seller" : "buyer";
  const sideContacts = clientContacts.filter((c) => c.roleType === wantRole);

  const suggestedName = `${side === "sale" ? "Sale" : "Purchase"} of ${shortAddress(address)}`;
  const numbersBlock = sideContacts.map((c) => `+${toWaDigits(c.phone!)}`).join("\n");

  function pulseStep(num: string) {
    setSheenStep(num);
    setTimeout(() => setSheenStep((cur) => (cur === num ? null : cur)), 720);
  }

  function copy(text: string, key: string, step?: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      if (step) pulseStep(step);
      setTimeout(() => setCopiedKey(null), 1600);
    });
  }

  function openWhatsApp() {
    pulseStep("03");
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

  const showInviteFlow = !!currentInviteUrl && !editing;

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel="WhatsApp group helper">
      <style>{`
        @keyframes wa-num-sheen { 0% { transform: translateX(-140%) skewX(-18deg); } 100% { transform: translateX(160%) skewX(-18deg); } }
        .wa-num { position: relative; overflow: hidden; }
        .wa-num-sheen::after {
          content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 55%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.9), transparent);
          animation: wa-num-sheen 700ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) { .wa-num-sheen::after { animation: none; } }
      `}</style>

      <Modal.Header>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "relative", overflow: "hidden", paddingRight: 28 }}>
          <HouseSketch />
          <span
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: "#25D366", color: "#fff", boxShadow: "0 2px 8px rgba(37,211,102,0.35)",
            }}
          >
            <WhatsappLogo size={24} weight="fill" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                Set up {sideWord} WhatsApp group
              </h2>
              <SidePill side={side} onToggle={() => setSide((s) => (s === "sale" ? "purchase" : "sale"))} />
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {shortAddress(address)}
            </p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
                  <PersonRow
                    key={c.id}
                    contact={c}
                    action={
                      <button
                        type="button"
                        onClick={() => inviteViaWhatsApp(c)}
                        className="agent-btn agent-btn-xs"
                        style={{ background: "#25D366", color: "white", borderColor: "#25D366", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}
                      >
                        <WhatsappLogo size={12} weight="fill" />
                        Send invite
                      </button>
                    }
                  />
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
            <Step num="01" title="Group name" sheen={sheenStep === "01"}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  readOnly
                  value={suggestedName}
                  className="agent-input"
                  style={{ flex: 1, height: 40, fontSize: 13 }}
                />
                <CopyBtn
                  label={copiedKey === "name" ? "Copied" : "Copy"}
                  onClick={() => copy(suggestedName, "name", "01")}
                />
              </div>
            </Step>

            <Step num="02" title="People to add" sheen={sheenStep === "02"}>
              {sideContacts.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                  No {sideWord} phone numbers on file. Add one to the {sideWord} contact first.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sideContacts.map((c) => (
                    <PersonRow
                      key={c.id}
                      contact={c}
                      action={
                        <CopyBtn
                          label={copiedKey === `num-${c.id}` ? "Copied" : "Copy"}
                          onClick={() => copy(`+${toWaDigits(c.phone!)}`, `num-${c.id}`, "02")}
                        />
                      }
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => copy(numbersBlock, "numbers", "02")}
                    className="agent-link"
                    style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, marginTop: 2, color: "var(--agent-coral-deep)" }}
                  >
                    <Copy size={12} />
                    {copiedKey === "numbers" ? "Copied" : "Copy all"}
                  </button>
                </div>
              )}
            </Step>

            <Step num="03" title="Create in WhatsApp" sheen={sheenStep === "03"}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5, flex: 1, minWidth: 180 }}>
                  Create a new WhatsApp group, then paste in the people above.
                </p>
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="agent-btn agent-btn-sm"
                  style={{
                    background: "#fff", color: "#1FA855", border: "1.5px solid #25D366", borderRadius: 10,
                    display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, fontWeight: 600,
                  }}
                >
                  <WhatsappLogo size={15} weight="fill" color="#25D366" />
                  Open WhatsApp
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "var(--agent-text-muted)" }}>
                <Lock size={12} weight="regular" />
                You&rsquo;ll leave TSP to create the group.
              </div>
            </Step>

            <Step num="04" title="Connect the group" sheen={false} last>
              <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                Paste the WhatsApp group invite link so TSP knows which conversation belongs to this sale.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://chat.whatsapp.com/…"
                  className="agent-input"
                  style={{ flex: 1, height: 40, fontSize: 13 }}
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

      <Modal.Footer>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--agent-text-muted)", minWidth: 0 }}>
            <ShieldCheck size={15} weight="regular" style={{ flexShrink: 0 }} />
            Only people with access to this sale will see the group.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="agent-btn agent-btn-sm"
            style={{
              flexShrink: 0, background: "transparent", color: "var(--agent-coral-deep)",
              border: "1px solid var(--agent-coral)", fontWeight: 600,
            }}
          >
            Done
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

// ── Header side pill — coral, doubles as the Seller / Buyer switch ──
function SidePill({ side, onToggle }: { side: Side; onToggle: () => void }) {
  const label = side === "sale" ? "Seller" : "Buyer";
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Switch to ${side === "sale" ? "buyer" : "seller"} group`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
        padding: "3px 9px", borderRadius: 999, cursor: "pointer",
        background: "rgba(var(--agent-coral-rgb), 0.10)", color: "var(--agent-coral-deep)",
        border: "1px solid rgba(var(--agent-coral-rgb), 0.30)",
        fontSize: 11.5, fontWeight: 600,
      }}
    >
      <User size={12} weight="regular" />
      {label}
      <CaretDown size={10} weight="bold" style={{ opacity: 0.7 }} />
    </button>
  );
}

// ── A client row: tinted person avatar + name · role + phone, then an action ──
function PersonRow({ contact, action }: { contact: Contact; action: ReactNode }) {
  const tint = contact.roleType === "vendor"
    ? { bg: "rgba(var(--agent-coral-rgb), 0.12)", fg: "var(--agent-coral-deep)" }
    : { bg: "rgba(59,130,246,0.12)", fg: "#2f74e0" };
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        padding: "8px 10px", borderRadius: 10,
        border: "0.5px solid var(--agent-border-default)",
        background: "var(--agent-surface-elevated)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: tint.bg, color: tint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <User size={17} weight="regular" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.name}</span>
            <span style={{ fontSize: 12, color: "var(--agent-text-muted)", flexShrink: 0 }}>· {friendlyRole(contact.roleType)}</span>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{contact.phone}</span>
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Coral-outlined copy button (matches the mock's Copy pills) ──
function CopyBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
        padding: "7px 12px", borderRadius: 9, cursor: "pointer",
        background: "transparent", color: "var(--agent-coral-deep)",
        border: "1px solid rgba(var(--agent-coral-rgb), 0.35)",
        fontSize: 12.5, fontWeight: 600,
      }}
    >
      <Copy size={13} />
      {label}
    </button>
  );
}

// ── One numbered step: a coral circle (sheen-capable) + dashed connector ──
function Step({ num, title, last = false, sheen = false, children }: { num: string; title: string; last?: boolean; sheen?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <span
          className={`wa-num${sheen ? " wa-num-sheen" : ""}`}
          style={{
            width: 30, height: 30, borderRadius: 999, flexShrink: 0,
            border: "1.5px solid var(--agent-coral)",
            color: "var(--agent-coral-deep)", background: "var(--agent-coral-bg-tint)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 11.5, fontWeight: 700,
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
        <h3 style={{ margin: "5px 0 10px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--agent-text-muted)",
};
