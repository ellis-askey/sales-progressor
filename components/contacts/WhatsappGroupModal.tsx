"use client";
// components/contacts/WhatsappGroupModal.tsx
//
// Set up + use a WhatsApp group for a sale. Per-side (2026-11-10): seller and
// buyer get SEPARATE groups so the two sides never share a chat or see each
// other's numbers. The header pill switches side; each side stores its own
// invite link (whatsappSellerGroupUrl / whatsappBuyerGroupUrl).
//
// Two stages per side:
//   Create  (no link saved yet): name the group, create it in WhatsApp (with
//            just you), paste the group's invite link. We never create a group
//            or add anyone; the human does that in WhatsApp.
//   Invite  (link saved): send each client a personalised join message. Each
//            "Send invite" opens a WhatsApp message with the link pre-typed; the
//            agent still presses send. Nothing fires automatically. The Invited
//            ticks are an in-session progress aid (we can't know who actually
//            joined, which happens inside WhatsApp).

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  setWhatsappGroupInviteUrlAction,
  removeWhatsappGroupInviteUrlAction,
} from "@/app/actions/property-extras";
import { WhatsappLogo, Copy, Check, ArrowSquareOut, Trash, PencilSimple, ShieldCheck, User } from "@phosphor-icons/react";

type Contact = { id: string; name: string; phone: string | null; roleType: string };
type Side = "seller" | "buyer";

// Normalise a UK phone into wa.me format.
function toWaDigits(phone: string): string {
  let digits = phone.replace(/[\s\-().+]/g, "");
  if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  return digits;
}
function shortAddress(address: string): string {
  return address.split(",")[0]?.trim() || address;
}
function firstName(name: string): string {
  return name.trim().split(/\s+/).filter((w) => !/^(mr|mrs|ms|miss|mx|dr)\.?$/i.test(w))[0] ?? name;
}

export function WhatsappGroupModal({
  open,
  onClose,
  transactionId,
  address,
  contacts,
  sellerUrl,
  buyerUrl,
}: {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  address: string;
  contacts: Contact[];
  sellerUrl: string | null;
  buyerUrl: string | null;
}) {
  const { toast } = useAgentToast();
  const [side, setSide] = useState<Side>("seller");
  const [linkInput, setLinkInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  // In-session "invite opened" markers, keyed by contact id. Not persisted:
  // opening the WhatsApp draft doesn't mean it was sent or joined, so this is a
  // progress aid for the current sitting, not a claim of record.
  const [invited, setInvited] = useState<Set<string>>(new Set());

  // Per-side link (local copy so a save/remove reflects instantly without a
  // refetch). Seeded from props each render via the key below.
  const [sellerLink, setSellerLink] = useState<string | null>(sellerUrl);
  const [buyerLink, setBuyerLink] = useState<string | null>(buyerUrl);
  const currentUrl = side === "seller" ? sellerLink : buyerLink;

  const wantRole = side === "seller" ? "vendor" : "purchaser";
  const sideWord = side === "seller" ? "seller" : "buyer";
  const roleLabel = side === "seller" ? "Seller" : "Buyer";
  const saleWord = side === "seller" ? "sale" : "purchase";
  const sideContacts = contacts.filter((c) => c.roleType === wantRole && c.phone);
  const suggestedName = `${side === "seller" ? "Sale" : "Purchase"} of ${shortAddress(address)}`;

  const showInviteFlow = !!currentUrl && !editing;

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  function openWhatsApp() {
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) window.location.href = "whatsapp://";
    else window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
  }

  async function saveLink() {
    setError(null);
    setSaving(true);
    try {
      await setWhatsappGroupInviteUrlAction(transactionId, side, linkInput);
      if (side === "seller") setSellerLink(linkInput.trim());
      else setBuyerLink(linkInput.trim());
      toast.success("Group link saved", { description: `You can now send invites to the ${sideWord}.` });
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
      await removeWhatsappGroupInviteUrlAction(transactionId, side);
      if (side === "seller") setSellerLink(null);
      else setBuyerLink(null);
      setEditing(false);
      toast.success("Group link removed");
    } finally {
      setSaving(false);
    }
  }

  function sendInvite(contact: Contact) {
    if (!contact.phone || !currentUrl) return;
    const digits = toWaDigits(contact.phone);
    const msg = `Hi ${firstName(contact.name)}, I've set up a WhatsApp group for your ${saleWord} at ${shortAddress(address)}. Join here: ${currentUrl}`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    setInvited((prev) => new Set(prev).add(contact.id));
  }

  const invitedCount = sideContacts.filter((c) => invited.has(c.id)).length;

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel="WhatsApp group helper" closeTone="onDark">
      {/* Header: bare icon (no eyebrow, no backer), title, address, side switch. */}
      <Modal.Header style={SHEET_BAND_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, paddingRight: 36 }}>
          <span style={{ color: "#fff", flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
            <WhatsappLogo size={30} weight="fill" />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
              Set up the {sideWord}&rsquo;s WhatsApp group
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>{shortAddress(address)}</div>
          </div>
          <button
            type="button"
            onClick={() => { setSide((s) => (s === "seller" ? "buyer" : "seller")); setEditing(false); setLinkInput(""); setError(null); }}
            title={`Switch to the ${side === "seller" ? "buyer" : "seller"}'s group`}
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.22)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {roleLabel} group · switch
          </button>
        </div>
      </Modal.Header>

      <Modal.Body style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sideContacts.length === 0 && (
          <div style={{ padding: 14, borderRadius: 10, background: "rgba(217,119,6,0.08)", border: "0.5px solid rgba(217,119,6,0.25)", fontSize: 13, color: "var(--agent-text-primary)" }}>
            No {sideWord} contact has a phone number on file yet. Add a phone number to the {sideWord} contact first, then come back here.
          </div>
        )}

        {/* ── INVITE STAGE ─────────────────────────────────────────── */}
        {showInviteFlow && sideContacts.length > 0 && (
          <>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--agent-text-muted)", marginBottom: 6 }}>Group set up</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <a href={currentUrl!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--agent-text-secondary)", textDecoration: "underline", wordBreak: "break-all" }}>{currentUrl}</a>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={() => copyText(currentUrl!)} className="agent-btn agent-btn-xs agent-btn-ghost-bordered" title="Copy group link">
                    {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                  </button>
                  <a href={currentUrl!} target="_blank" rel="noopener noreferrer" className="agent-btn agent-btn-xs agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <ArrowSquareOut size={12} /> Open
                  </a>
                </div>
              </div>
            </div>

            {/* Reassurance: the fear-killer, built into the structure. */}
            <div style={{ display: "flex", gap: 10, padding: "11px 13px", borderRadius: 11, background: "rgba(37,211,102,0.08)", border: "0.5px solid rgba(37,211,102,0.3)" }}>
              <span style={{ color: "#1FA855", flexShrink: 0, marginTop: 1 }}><WhatsappLogo size={16} weight="fill" /></span>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--agent-text-primary)" }}>Invites are sent individually.</strong> Select a client to open WhatsApp with their invitation ready to send. You&rsquo;ll need to press send yourself. Nothing is sent automatically, and clients won&rsquo;t be added to the group until they join using the link.
              </p>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--agent-text-muted)" }}>Invite the {sideWord}</span>
                <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{invitedCount} of {sideContacts.length} invited</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sideContacts.map((c) => {
                  const done = invited.has(c.id);
                  const tint = side === "seller"
                    ? { bg: "rgba(var(--agent-coral-rgb),0.12)", fg: "var(--agent-coral-deep)" }
                    : { bg: "rgba(59,130,246,0.14)", fg: "#2f74e0" };
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 12, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)" }}>
                      <span style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: tint.bg, color: tint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <User size={17} weight="regular" />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          <span style={{ fontSize: 12, color: "var(--agent-text-muted)", flexShrink: 0 }}>· {roleLabel}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: done ? "var(--agent-success)" : "var(--agent-text-muted)", marginTop: 1, fontWeight: done ? 600 : 400 }}>
                          {done ? "Invite opened in WhatsApp · you still press send" : `Opens WhatsApp to ${firstName(c.name)} with the join link`}
                        </div>
                      </div>
                      {done ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--agent-success)" }}>
                            <Check size={13} weight="bold" /> Invited
                          </span>
                          <button type="button" onClick={() => sendInvite(c)} className="agent-link" style={{ fontSize: 12 }}>Resend</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => sendInvite(c)} className="agent-btn agent-btn-sm" style={{ background: "#25D366", color: "#fff", borderColor: "#25D366", display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, fontWeight: 600 }}>
                          <WhatsappLogo size={14} weight="fill" /> Send invite
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => { setEditing(true); setLinkInput(currentUrl ?? ""); }} className="agent-btn agent-btn-xs agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <PencilSimple size={12} /> Replace link
              </button>
              <button type="button" onClick={removeLink} disabled={saving} className="agent-btn agent-btn-xs agent-btn-ghost-bordered" style={{ color: "var(--agent-danger)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Trash size={12} /> Remove link
              </button>
            </div>
          </>
        )}

        {/* ── CREATE STAGE ─────────────────────────────────────────── */}
        {(!showInviteFlow || editing) && sideContacts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 11, padding: "12px 14px", borderRadius: 12, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-subtle)" }}>
              <span style={{ color: "var(--agent-coral-deep)", flexShrink: 0, marginTop: 1 }}><WhatsappLogo size={18} weight="fill" /></span>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
                <strong style={{ color: "var(--agent-text-primary)" }}>How this works.</strong> You make the group in WhatsApp, and it starts with just you. The {sideWord} joins by tapping a link you send them, one at a time. Nothing is created or sent until you do it yourself.
              </p>
            </div>

            <Step n={1} title="Name the group">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input readOnly value={suggestedName} className="agent-input" style={{ flex: 1, height: 40, fontSize: 13, border: "0.5px solid var(--agent-border-default)" }} />
                <button type="button" onClick={() => copyText(suggestedName)} className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </Step>

            <Step n={2} title="Create it in WhatsApp">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5, flex: 1, minWidth: 180 }}>
                  Make a new group with just you in it. You&rsquo;ll bring the {sideWord} in with a link next, so there&rsquo;s no need to add their number here.
                </p>
                <button type="button" onClick={openWhatsApp} className="agent-btn agent-btn-sm" style={{ background: "#fff", color: "#1FA855", border: "1.5px solid #25D366", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, flexShrink: 0 }}>
                  <WhatsappLogo size={15} weight="fill" color="#25D366" /> Open WhatsApp
                </button>
              </div>
            </Step>

            <Step n={3} title="Paste the group's invite link" last>
              <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                In WhatsApp: tap the group name, choose <strong style={{ color: "var(--agent-text-secondary)" }}>Invite to group via link</strong>, then Copy link. Paste it here so this sale knows which chat is which.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="https://chat.whatsapp.com/…" className="agent-input" style={{ flex: 1, height: 40, fontSize: 13 }} />
                <button type="button" onClick={saveLink} disabled={saving || !linkInput.trim()} className="agent-btn agent-btn-sm agent-btn-primary" style={{ flexShrink: 0 }}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              {error && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--agent-danger)" }}>{error}</p>}
              {editing && (
                <button type="button" onClick={() => { setEditing(false); setLinkInput(""); setError(null); }} className="agent-btn agent-btn-neutral agent-btn-sm" style={{ marginTop: 8 }}>
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
            Only people with access to this sale can see this group.
          </span>
          <button type="button" onClick={onClose} className="agent-btn agent-btn-sm" style={{ flexShrink: 0, background: "transparent", color: "var(--agent-coral-deep)", border: "1px solid var(--agent-coral)", fontWeight: 600 }}>
            Done
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

// One numbered step: coral circle + dashed connector.
function Step({ n, title, last = false, children }: { n: number; title: string; last?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 13, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, border: "1.5px solid var(--agent-coral)", color: "var(--agent-coral-deep)", background: "var(--agent-coral-bg-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
          {n}
        </span>
        {!last && <span aria-hidden style={{ flex: 1, borderLeft: "1.5px dashed var(--agent-coral)", opacity: 0.35, margin: "4px 0", minHeight: 14 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 6 }}>
        <h3 style={{ margin: "5px 0 10px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
