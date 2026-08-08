"use client";
// components/contacts/ContactsSection.tsx
//
// Premium SaaS-style contacts card. Rewritten 2026-07-08 from the previous
// grid/list dual layout. Every card is a full-width row with:
//   - Left column: avatar + identity + contact details
//   - Right column: Call / WhatsApp / Email actions + Portal status card
//   - Kebab overflow (Edit / Delete) top-right
//
// Vendors always render before purchasers; other roles fall to the bottom.
//
// Portal card has three states:
//   - not_invited: grey dot,  "Not invited yet",  CTA: Send invite
//   - invited:     amber dot, "Invite sent",      CTA: Resend invite + copy-link
//   - active:      green dot, "Active",           info: last viewed relative
//
// Opted-out contacts (Contact.unsubscribedAt) show a small "Opted out"
// pill next to the email row. Email button stays functional so the agent
// can still send a manual one-off if needed.
//
// Delete goes through a confirmation modal (Modal primitive) rather than
// firing immediately.
//
// Mobile breakpoint: the right column drops below the left column below
// the medium breakpoint (~720px). The Portal card stays inside the row
// on both breakpoints so the visual grouping is preserved.

import { useState, useTransition } from "react";
import { CONTACT_ROLES, titleCase, normalizePhone } from "@/lib/utils";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { createContactAction, updateContactAction, deleteContactAction, generatePortalTokenAction } from "@/app/actions/contacts";
import { EmptyState } from "@/components/ui/EmptyState";
import { RoleIcon, ROLE_PILL_BG, roleColour, roleLabel, asRole } from "@/components/ui/RoleIcon";
import { Modal } from "@/components/ui/Modal";
import { Envelope, ArrowSquareOut, HouseSimple, Phone, ChatCircleText, EnvelopeSimple, DotsThreeVertical, PencilSimple, Trash, GlobeSimple, WhatsappLogo } from "@phosphor-icons/react";
import { WhatsappGroupModal } from "./WhatsappGroupModal";
import { PropertyPhotoField } from "./PropertyPhotoField";
import type { ContactRole } from "@prisma/client";
import { LastContactedPill } from "./LastContactedPill";
import { GlassCard } from "@/components/glass/GlassCard";

function whatsappHref(phone: string): string {
  let digits = phone.replace(/[\s\-().+]/g, "");
  if (digits.startsWith("07")) digits = "44" + digits.slice(1);
  else if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  return `whatsapp://send?phone=${digits}`;
}

const TITLE_RE = /^(dr|mr|mrs|miss|ms|prof|rev|sir|lady|lord|mx)\.?\s+/i;

function getInitials(name: string): string {
  const trimmed = name.trim();
  const titleMatch = trimmed.match(TITLE_RE);
  const withoutTitle = trimmed.replace(TITLE_RE, "").trim();
  const parts = withoutTitle.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1 && titleMatch) return (titleMatch[0].trim()[0] + parts[0][0]).toUpperCase();
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return trimmed[0]?.toUpperCase() ?? "?";
}

function emailHref(email: string, roleType: string, address: string): string {
  const isVendor = roleType === "vendor";
  const subject = isVendor
    ? `The Sale of ${address} - Your Sale Progression`
    : `The Purchase of ${address} - Your Sale Progression`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  roleType: string;
  portalToken: string | null;
  createdAt: Date;
  lastVisitedPortalAt?: Date | null;
  unsubscribedAt?: Date | null;
};

function fmtRelative(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const EMPTY_FORM = {
  name:     "",
  roleType: "vendor" as ContactRole,
  email:    "",
  phone:    "",
};

const INPUT = "glass-input w-full px-3 py-2 text-sm";
const SELECT = "glass-input w-full px-3 py-2 text-sm pr-8";

// Rolling-7-day chase-email thresholds, unchanged from previous impl.
const AUTO_EMAIL_AMBER_AT = 3;
const AUTO_EMAIL_RED_AT = 5;

function autoEmailTone(count: number): { bg: string; fg: string } | null {
  if (count <= 0) return null;
  if (count >= AUTO_EMAIL_RED_AT) return { bg: "rgba(var(--agent-danger-rgb), 0.10)", fg: "var(--agent-danger)" };
  if (count >= AUTO_EMAIL_AMBER_AT) return { bg: "rgba(var(--agent-warning-rgb), 0.10)", fg: "var(--agent-warning)" };
  return { bg: "rgba(15,23,42,0.06)", fg: "var(--agent-text-muted)" };
}

// ── Portal state resolver ──────────────────────────────────────────────
// Three visible states + a "no portal at all" case for non-vendor/purchaser
// roles (solicitors, brokers etc.). Consumers read this once per row.
type PortalState = "none" | "not_invited" | "invited" | "active";

function resolvePortalState(contact: Contact, lastViewed: Date | undefined): PortalState {
  const role = asRole(contact.roleType);
  if (role !== "vendor" && role !== "purchaser") return "none";
  if (!contact.portalToken) return "not_invited";
  if (lastViewed) return "active";
  return "invited";
}

// ── Communication action button ────────────────────────────────────────
function CommsButton({
  href,
  label,
  icon,
  disabled,
  title,
}: {
  href?: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    color: disabled ? "var(--agent-text-muted)" : "var(--agent-text-secondary)",
    padding: "7px 12px",
    borderRadius: 8,
    border: "0.5px solid var(--agent-border-default)",
    background: "var(--agent-surface-elevated)",
    textDecoration: "none",
    minWidth: 88,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "background 140ms ease, border-color 140ms ease",
  };
  if (disabled || !href) {
    return (
      <button type="button" disabled title={title} style={style}>
        {icon}
        <span>{label}</span>
      </button>
    );
  }
  return (
    <a href={href} title={title} style={style}>
      {icon}
      <span>{label}</span>
    </a>
  );
}

// ── Portal status card ─────────────────────────────────────────────────
function PortalStatusCard({
  state,
  lastViewed,
  hasEmail,
  onSendInvite,
  onSetupToken,
  onCopyLink,
  inviting,
  inviteSent,
  generatingToken,
  copied,
}: {
  state: PortalState;
  lastViewed: Date | undefined;
  hasEmail: boolean;
  onSendInvite: () => void;
  onSetupToken: () => void;
  onCopyLink: () => void;
  inviting: boolean;
  inviteSent: boolean;
  generatingToken: boolean;
  copied: boolean;
}) {
  if (state === "none") return null;

  const dot = state === "active" ? "#16a34a" : state === "invited" ? "#d97706" : "#94a3b8";
  const statusLabel = state === "active"
    ? "Active"
    : state === "invited"
      ? (hasEmail ? "Invite sent" : "Portal link ready")
      : "Not invited yet";
  const subLabel = state === "active" && lastViewed ? `Last viewed ${fmtRelative(lastViewed)}` : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 10,
        border: "0.5px solid var(--agent-border-default)",
        background: "var(--agent-surface-elevated)",
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* Icon square */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          background: state === "active" ? "rgba(22,163,74,0.10)" : state === "invited" ? "rgba(217,119,6,0.10)" : "rgba(148,163,184,0.14)",
          color: state === "active" ? "#16a34a" : state === "invited" ? "#d97706" : "#64748b",
          flexShrink: 0,
        }}
      >
        <GlobeSimple size={16} weight="regular" />
      </span>

      {/* Status text */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>Portal access</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--agent-text-muted)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
          {statusLabel}
          {subLabel && <span style={{ marginLeft: 2 }}>· {subLabel}</span>}
        </span>
      </div>

      {/* CTA cluster */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {state === "not_invited" && (
          <button
            type="button"
            onClick={onSetupToken}
            disabled={generatingToken}
            className="agent-btn agent-btn-xs agent-btn-primary"
            title={hasEmail ? "Generate portal link and email the invite to this contact" : "Generate portal link so you can share it manually (no email on file to send an invite to)"}
          >
            {generatingToken ? "Setting up…" : (hasEmail ? "Send invite" : "Set up link")}
          </button>
        )}
        {state === "invited" && (
          <>
            {hasEmail && (
              <button
                type="button"
                onClick={onSendInvite}
                disabled={inviting}
                className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
              >
                {inviteSent ? "✓ Sent" : inviting ? "Sending…" : "Resend invite"}
              </button>
            )}
            <button
              type="button"
              onClick={onCopyLink}
              title="Copy portal link"
              aria-label="Copy portal link"
              className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
              style={{ minWidth: 34, padding: "0 8px" }}
            >
              {copied ? "✓" : <ArrowSquareOut size={12} weight="regular" />}
            </button>
          </>
        )}
        {state === "active" && (
          <button
            type="button"
            onClick={onCopyLink}
            title="Copy portal link"
            aria-label="Copy portal link"
            className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
            style={{ minWidth: 34, padding: "0 8px" }}
          >
            {copied ? "✓" : <ArrowSquareOut size={12} weight="regular" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Kebab overflow menu ────────────────────────────────────────────────
function RowKebab({
  onEdit,
  onDelete,
  contactName,
}: {
  onEdit: () => void;
  onDelete: () => void;
  contactName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${contactName}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          border: "0.5px solid var(--agent-border-default)",
          background: "var(--agent-surface-elevated)",
          color: "var(--agent-text-muted)",
          cursor: "pointer",
        }}
      >
        <DotsThreeVertical size={16} weight="bold" />
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 1499 }}
          />
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              minWidth: 140,
              padding: 4,
              borderRadius: 10,
              border: "0.5px solid var(--agent-border-default)",
              background: "var(--agent-surface-elevated)",
              boxShadow: "0 8px 24px rgba(15,23,42,0.10)",
              zIndex: 1500,
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onEdit(); }}
              style={menuItemStyle("var(--agent-text-primary)")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <PencilSimple size={14} weight="regular" />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onDelete(); }}
              style={menuItemStyle("var(--agent-danger)")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220,38,38,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Trash size={14} weight="regular" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function menuItemStyle(color: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 500,
    color,
    background: "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    textAlign: "left",
  };
}

export function ContactsSection({
  transactionId,
  contacts,
  address = "",
  portalViewDates = {},
  automatedEmailCounts = {},
  lastContactedByContactId = {},
  whatsappGroupInviteUrl = null,
  photoUrl = null,
}: {
  transactionId: string;
  contacts: Contact[];
  address?: string;
  portalViewDates?: Record<string, Date>;
  automatedEmailCounts?: Record<string, number>;
  lastContactedByContactId?: Record<string, string>;
  // Optional WhatsApp group invite link the agent has already saved.
  // Null when the agent hasn't set one up yet — Phase 1 of the modal.
  whatsappGroupInviteUrl?: string | null;
  // Signed URL for the current property photo (or null). Feeds the
  // PropertyPhotoField preview so it doesn't have to fetch itself.
  photoUrl?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useAgentToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  function copyPortalLink(token: string) {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function sendInvite(token: string, contactId: string) {
    setInviting(contactId);
    try {
      const res = await fetch("/api/portal/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const contactName = contacts.find((c) => c.id === contactId)?.name ?? "contact";
        toast.success(`Invite sent to ${contactName}`, { description: "They'll receive an email shortly" });
        setInviteSent(contactId);
        setTimeout(() => setInviteSent(null), 3000);
        window.dispatchEvent(new CustomEvent("sp_onboarding_step", { detail: { hasContactEmail: true } }));
      }
    } finally {
      setInviting(null);
    }
  }

  async function setupPortalToken(contactId: string) {
    setGeneratingToken(contactId);
    try {
      const { portalToken } = await generatePortalTokenAction(contactId, transactionId);
      // If the contact has an email, chain the invite send in the same user
      // action so "Send invite" from the not-invited state is a single click.
      // If there's no email, we just leave the token generated — the state
      // will transition to "invited" (button label "Portal link ready") so
      // the agent can copy the link and share it manually.
      const contact = contacts.find((c) => c.id === contactId);
      if (portalToken && contact?.email) {
        await sendInvite(portalToken, contactId);
      }
    } finally {
      setGeneratingToken(null);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function describeContactError(err: unknown): string {
    if (err instanceof Error) {
      if (err.message === "DUPLICATE_CONTACT_FIELD") {
        const e = err as Error & { kind?: "phone" | "email"; withName?: string };
        const field = e.kind === "phone" ? "phone number" : "email";
        return `This ${field} is already used by ${e.withName ?? "another contact"} on this file.`;
      }
      return err.message;
    }
    return "Something went wrong";
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setShowForm(false);
    const snap = { propertyTransactionId: transactionId, name: titleCase(form.name), email: form.email.trim() || null, phone: form.phone.trim() || null, roleType: form.roleType };
    const formSnap = { ...form };
    startTransition(async () => {
      try {
        await createContactAction(snap);
        setForm(EMPTY_FORM);
      } catch (err: unknown) {
        setForm(formSnap);
        setError(describeContactError(err));
        setShowForm(true);
      } finally {
        setLoading(false);
      }
    });
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setExitingId(null);
    setEditError(null);
    setEditForm({ name: contact.name, phone: contact.phone ?? "", email: contact.email ?? "" });
  }

  function closeEdit() {
    setExitingId(editingId);
    setEditError(null);
    setTimeout(() => {
      setEditingId(null);
      setExitingId(null);
    }, 150);
  }

  function handleEdit(contactId: string) {
    setEditSaving(true);
    setEditError(null);
    const snap = { id: contactId, transactionId, name: titleCase(editForm.name), phone: editForm.phone.trim() ? normalizePhone(editForm.phone) : null, email: editForm.email.trim() || null };
    startTransition(async () => {
      try {
        await updateContactAction(snap);
        if (snap.phone || snap.email) {
          window.dispatchEvent(new CustomEvent("sp_onboarding_step", { detail: { hasContactDetails: true } }));
        }
        setExitingId(contactId);
        setTimeout(() => {
          setEditingId(null);
          setExitingId(null);
        }, 150);
      } catch (err: unknown) {
        setEditError(describeContactError(err));
      } finally {
        setEditSaving(false);
      }
    });
  }

  function requestDelete(contact: Contact) {
    setConfirmDelete(contact);
  }

  function performDelete() {
    if (!confirmDelete) return;
    const contactId = confirmDelete.id;
    setDeleting(true);
    startTransition(async () => {
      try {
        await deleteContactAction(contactId, transactionId);
        setConfirmDelete(null);
      } finally {
        setDeleting(false);
      }
    });
  }

  // ── Sorted contacts: vendor → purchaser → other, then createdAt ────
  const ROLE_ORDER: Record<string, number> = { vendor: 0, purchaser: 1 };
  const sortedContacts = [...contacts].sort((a, b) => {
    const oa = ROLE_ORDER[a.roleType] ?? 2;
    const ob = ROLE_ORDER[b.roleType] ?? 2;
    if (oa !== ob) return oa - ob;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    // Design Lab: `contacts-card`. Default codified to v22 (Iridescent,
    // Decorative family) after Ellis's 2026-08-08 pass. The overflow +
    // border-radius stay on the wrapper so nested contact rows still
    // clip correctly, and the ::before iridescent overlay is anchored
    // to the wrapper's border-radius via `inherit`.
    <GlassCard glassId="contacts-card" label="Contacts card" defaultVariant="v22" className="overflow-hidden" style={{ borderRadius: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {/* Property photo (agent-only). Compact tile + upload/replace/remove. */}
          <PropertyPhotoField transactionId={transactionId} initialUrl={photoUrl} />
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 22, height: 22, borderRadius: 6,
                background: "rgba(var(--agent-coral-rgb), 0.12)",
                color: "var(--agent-coral-deep)",
              }}>
                <HouseSimple size={12} weight="regular" />
              </span>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>Contacts</h3>
              {contacts.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", padding: "1px 7px", borderRadius: 10, background: "rgba(15,23,42,0.06)" }}>
                  {contacts.length}
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>People associated with this transaction</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setWhatsappOpen(true)}
            className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            title={whatsappGroupInviteUrl ? "Invite clients to the group" : "Set up a WhatsApp group for this sale"}
          >
            <WhatsappLogo size={13} weight="fill" style={{ color: "#25D366" }} />
            {whatsappGroupInviteUrl ? "WhatsApp group" : "Set up WhatsApp group"}
          </button>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="agent-btn agent-btn-sm agent-btn-primary"
            >
              + Add contact
            </button>
          )}
        </div>
      </div>

      {/* Contact cards, stacked full-width */}
      {sortedContacts.length > 0 && (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedContacts.map((contact) => {
            const role = contact.roleType as ContactRole;
            const r = asRole(role) ?? "other";
            const isEditing = editingId === contact.id;
            const isExiting = exitingId === contact.id;
            const lastViewed = portalViewDates[contact.id];
            const portalState = resolvePortalState(contact, lastViewed);
            const optedOut = contact.unsubscribedAt != null;
            const autoCount = automatedEmailCounts[contact.id] ?? 0;
            const autoTone = autoEmailTone(autoCount);

            return (
              <div
                key={contact.id}
                className="contacts-row"
                style={{
                  border: "0.5px solid var(--agent-border-default)",
                  borderRadius: 12,
                  background: "var(--agent-surface-elevated)",
                  overflow: "hidden",
                  transition: "box-shadow 160ms ease, border-color 160ms ease",
                }}
              >
                {!isEditing && !isExiting && (
                  <div
                    className="contacts-row-body"
                    style={{
                      padding: "14px 16px",
                      display: "flex",
                      gap: 16,
                      alignItems: "flex-start",
                    }}
                  >
                    {/* ── Left column: identity + contact details ── */}
                    <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 0 }}>
                      <div className="agent-avatar agent-avatar-md" style={{ flexShrink: 0 }}>{getInitials(contact.name)}</div>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                        {/* Name + role */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span data-sensitive="true" style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{contact.name}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, borderRadius: 4, padding: "1px 6px", background: ROLE_PILL_BG[r], color: roleColour(r) }}>
                            <RoleIcon role={r} size={11} />
                            {roleLabel(r)}
                          </span>
                        </div>

                        {/* Status pills row: last contacted, chase count, opted out */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <LastContactedPill lastContactedAt={lastContactedByContactId[contact.id]} />
                          {autoTone && (
                            <span
                              title={autoCount >= AUTO_EMAIL_RED_AT
                                ? `${autoCount} automated chase email${autoCount === 1 ? "" : "s"} sent to this contact in the last 7 days — likely over-chasing; consider pausing client emails`
                                : autoCount >= AUTO_EMAIL_AMBER_AT
                                  ? `${autoCount} automated chase email${autoCount === 1 ? "" : "s"} sent to this contact in the last 7 days — review chase cadence`
                                  : `${autoCount} automated chase email${autoCount === 1 ? "" : "s"} sent to this contact in the last 7 days`}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 3,
                                fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                                background: autoTone.bg, color: autoTone.fg,
                              }}
                            >
                              <Envelope size={11} weight="fill" />
                              {`${autoCount} chase${autoCount === 1 ? "" : "s"} this week`}
                            </span>
                          )}
                          {optedOut && (
                            <span
                              title="This client has opted out of automated emails via the unsubscribe link."
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 3,
                                fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                                background: "rgba(148,163,184,0.14)", color: "#64748b",
                              }}
                            >
                              Opted out
                            </span>
                          )}
                        </div>

                        {/* Phone + email rows */}
                        {contact.phone && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <Phone size={13} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
                            <a
                              data-sensitive="true"
                              href={`tel:${contact.phone}`}
                              className="agent-link agent-link-muted"
                              style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {contact.phone}
                            </a>
                          </div>
                        )}
                        {contact.email && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <EnvelopeSimple size={13} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
                            <a
                              data-sensitive="true"
                              href={emailHref(contact.email, contact.roleType, address)}
                              className="agent-link agent-link-muted"
                              style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {contact.email}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Right column: comms actions + portal ── */}
                    <div
                      className="contacts-row-right"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        alignItems: "stretch",
                        minWidth: 340,
                        maxWidth: 380,
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                        <CommsButton
                          href={contact.phone ? `tel:${contact.phone}` : undefined}
                          label="Call"
                          icon={<Phone size={13} weight="regular" />}
                          disabled={!contact.phone}
                          title={contact.phone ? "Call" : "No phone number on file"}
                        />
                        <CommsButton
                          href={contact.phone ? whatsappHref(contact.phone) : undefined}
                          label="WhatsApp"
                          icon={<ChatCircleText size={13} weight="regular" />}
                          disabled={!contact.phone}
                          title={contact.phone ? "WhatsApp" : "No phone number on file"}
                        />
                        <CommsButton
                          href={contact.email ? emailHref(contact.email, contact.roleType, address) : undefined}
                          label="Email"
                          icon={<EnvelopeSimple size={13} weight="regular" />}
                          disabled={!contact.email}
                          title={contact.email ? (optedOut ? "Client has opted out. Send manually with care." : "Email") : "No email on file"}
                        />
                        <RowKebab
                          contactName={contact.name}
                          onEdit={() => startEdit(contact)}
                          onDelete={() => requestDelete(contact)}
                        />
                      </div>
                      {portalState !== "none" && (
                        <PortalStatusCard
                          state={portalState}
                          lastViewed={lastViewed}
                          hasEmail={!!contact.email}
                          onSendInvite={() => contact.portalToken && sendInvite(contact.portalToken, contact.id)}
                          onSetupToken={() => setupPortalToken(contact.id)}
                          onCopyLink={() => contact.portalToken && copyPortalLink(contact.portalToken)}
                          inviting={inviting === contact.id}
                          inviteSent={inviteSent === contact.id}
                          generatingToken={generatingToken === contact.id}
                          copied={copied === contact.portalToken}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Edit form — slides in below */}
                {(isEditing || isExiting) && (
                  <div
                    className={isExiting ? "agent-reveal-out" : "agent-reveal-in"}
                    style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Full name"
                      className={INPUT}
                    />
                    <input
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone"
                      className={INPUT}
                    />
                    <input
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                      className={INPUT}
                    />
                    {editError && editingId === contact.id && (
                      <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
                        {editError}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                      <button onClick={closeEdit} className="agent-btn agent-btn-xs agent-btn-ghost-bordered">
                        Cancel
                      </button>
                      <button
                        onClick={() => handleEdit(contact.id)}
                        disabled={editSaving || !editForm.name.trim()}
                        className="agent-btn agent-btn-xs agent-btn-primary"
                      >
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {contacts.length === 0 && !showForm && (
        <EmptyState
          compact
          title="No contacts yet"
          description="Add vendors, purchasers, and other parties."
        />
      )}

      {/* Add contact form */}
      {showForm && (
        <div className={`p-5${contacts.length > 0 ? " border-t border-white/20" : ""}`}>
          <h3 className="text-sm font-semibold text-slate-900/90 mb-4">New contact</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder="Full name or company" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">
                  Role <span className="text-red-500">*</span>
                </label>
                <select name="roleType" value={form.roleType} onChange={handleChange} className={SELECT}>
                  {CONTACT_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">Email</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">Phone</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="07700 900 000" className={INPUT} />
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={loading || isPending} className="agent-btn agent-btn-sm agent-btn-primary">
                {loading ? "Adding…" : "Add contact"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); setForm(EMPTY_FORM); }}
                className="agent-btn agent-btn-sm agent-btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <Modal
          open={true}
          onClose={() => { if (!deleting) setConfirmDelete(null); }}
          size="sm"
          ariaLabel="Remove contact"
        >
          <Modal.Header>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              Remove contact
            </h2>
          </Modal.Header>
          <Modal.Body>
            <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-primary)", lineHeight: 1.5 }}>
              Remove <strong>{confirmDelete.name}</strong> from this file? Their portal access will be revoked and they'll no longer receive updates.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              disabled={deleting}
              className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={performDelete}
              disabled={deleting}
              className="agent-btn agent-btn-sm"
              style={{
                background: "var(--agent-danger)",
                color: "white",
                borderColor: "var(--agent-danger)",
              }}
            >
              {deleting ? "Removing…" : "Remove"}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {/* WhatsApp group helper modal */}
      <WhatsappGroupModal
        open={whatsappOpen}
        onClose={() => setWhatsappOpen(false)}
        transactionId={transactionId}
        address={address}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone, roleType: c.roleType }))}
        currentInviteUrl={whatsappGroupInviteUrl}
      />

      {/* Mobile responsive rules */}
      <style jsx>{`
        @media (max-width: 720px) {
          :global(.contacts-row-body) {
            flex-direction: column !important;
          }
          :global(.contacts-row-right) {
            min-width: 0 !important;
            max-width: none !important;
            width: 100% !important;
          }
        }
      `}</style>
    </GlassCard>
  );
}
