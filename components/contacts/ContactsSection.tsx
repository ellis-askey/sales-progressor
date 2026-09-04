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
// Portal card states (truthful, resilience audit PR 7 — the label reflects what
// actually happened, not just "does a link exist"):
//   - ready_to_invite: grey dot,  "Ready to invite",   CTA: Send invite
//   - invited:         amber dot, "Invite sent",       CTA: Resend invite + copy-link
//   - link_ready:      grey dot,  "Portal link ready", CTA: copy-link (no email on file)
//   - active:          green dot, "Active",            info: last viewed relative
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

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { CONTACT_ROLES, titleCaseKeepAcronyms, normalizePhone } from "@/lib/utils";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { createContactAction, updateContactAction, deleteContactAction, generatePortalTokenAction } from "@/app/actions/contacts";
import { EmptyState } from "@/components/ui/EmptyState";
import { CommsButton } from "@/components/ui/CommsButton";
import { roleLabel, asRole } from "@/components/ui/RoleIcon";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { Envelope, ArrowSquareOut, Phone, ChatCircleText, EnvelopeSimple, DotsThreeVertical, PencilSimple, Trash, GlobeSimple, WhatsappLogo, ClipboardText } from "@phosphor-icons/react";
import { WhatsappGroupModal } from "./WhatsappGroupModal";
import { IntroCallDrawer } from "@/components/transaction/IntroCallDrawer";
import { getIntroCallDataAction, type IntroCallData } from "@/app/actions/intro-call";
import type { ContactRole } from "@prisma/client";
import { LastContactedPill } from "./LastContactedPill";
import { GlassCard } from "@/components/glass/GlassCard";
import { ContactAvatar } from "@/components/ui/Avatar";

function whatsappHref(phone: string): string {
  let digits = phone.replace(/[\s\-().+]/g, "");
  if (digits.startsWith("07")) digits = "44" + digits.slice(1);
  else if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  return `whatsapp://send?phone=${digits}`;
}

const TITLE_RE = /^(dr|mr|mrs|miss|ms|prof|rev|sir|lady|lord|mx)\.?\s+/i;

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
  // Note B: a helper is someone on a side who isn't the actual client. They're
  // never named in confirmations; portalEligible controls their portal/emails.
  isPrincipal?: boolean;
  portalEligible?: boolean;
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
  isHelper:   false,
  givePortal: false,
};

const INPUT = "agent-input";
const SELECT = "agent-input pr-8";

// Rolling-7-day chase-email thresholds, unchanged from previous impl.
const AUTO_EMAIL_AMBER_AT = 3;
const AUTO_EMAIL_RED_AT = 5;

function autoEmailTone(count: number): { bg: string; fg: string } | null {
  if (count <= 0) return null;
  if (count >= AUTO_EMAIL_RED_AT) return { bg: "rgba(var(--agent-danger-rgb), 0.10)", fg: "var(--agent-danger)" };
  if (count >= AUTO_EMAIL_AMBER_AT) return { bg: "rgba(var(--agent-warning-rgb), 0.10)", fg: "var(--agent-warning)" };
  return { bg: "rgba(15,23,42,0.06)", fg: "var(--agent-text-muted)" };
}

// Role -> canonical Pill tone. Vendor = seller-blue, purchaser = buyer-green,
// matching the side-tinted avatars (Avatar.tsx SIDE_STYLES). Everyone else
// stays quiet. (Kept in sync with SolicitorSection so both cards read alike.)
function roleTone(r: string): "info" | "success" | "muted" {
  return r === "vendor" ? "info" : r === "purchaser" ? "success" : "muted";
}

// ── Portal state resolver ──────────────────────────────────────────────
// Three visible states + a "no portal at all" case for non-vendor/purchaser
// roles (solicitors, brokers etc.). Consumers read this once per row.
// Truthful portal states (resilience audit PR 7). Previously "invited" was
// returned for any contact with a token (always minted at creation), so every
// client read "Invite sent" from birth. Now the state reflects what actually
// happened:
//   active          - they've opened their portal (lastVisitedPortalAt)
//   invited          - a portal-link email has genuinely gone to them
//   ready_to_invite  - they have an email, but nothing has been sent yet
//   link_ready       - no email on file, so we can't email them (share manually)
type PortalState = "none" | "ready_to_invite" | "link_ready" | "invited" | "active";

function resolvePortalState(contact: Contact, lastViewed: Date | undefined, linkSent: boolean): PortalState {
  const role = asRole(contact.roleType);
  if (role !== "vendor" && role !== "purchaser") return "none";
  // Note B: a helper without portal access (isPrincipal false, not opted in)
  // has a token minted at creation but no portal/emails — hide the portal card.
  if (contact.isPrincipal === false && contact.portalEligible === false) return "none";
  if (lastViewed) return "active";              // they've opened it
  if (linkSent) return "invited";               // a link email actually went out
  if (contact.email) return "ready_to_invite";  // can be invited, nothing sent yet
  return "link_ready";                          // no email; link exists to share manually
}

// ── Communication action button ────────────────────────────────────────
// CommsButton now lives in components/ui/CommsButton.tsx (shared with the
// Solicitors card so both lay out identically). 2026-08-10.

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
      ? "Invite sent"
      : state === "ready_to_invite"
        ? "Ready to invite"
        : "Portal link ready";
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
        background: "var(--agent-surface-nested-strong)",
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* Portal-status icon — no background box; the icon colour still carries
          the state (green active / amber invited / grey not invited). */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          color: state === "active" ? "#16a34a" : state === "invited" ? "#d97706" : "#64748b",
          flexShrink: 0,
        }}
      >
        <GlobeSimple size={28} weight="regular" />
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
        {state === "ready_to_invite" && (
          <button
            type="button"
            onClick={onSendInvite}
            disabled={inviting}
            className="agent-btn agent-btn-xs agent-btn-primary"
            title="Email this client their portal link"
          >
            {inviteSent ? "✓ Sent" : inviting ? "Sending…" : "Send invite"}
          </button>
        )}
        {state === "link_ready" && (
          <button
            type="button"
            onClick={onCopyLink}
            title="No email on file, so copy the portal link to share it manually"
            aria-label="Copy portal link"
            className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
            style={{ minWidth: 34, padding: "0 8px" }}
          >
            {copied ? "✓" : <ArrowSquareOut size={12} weight="regular" />}
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
  onIntroCall,
  contactName,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onIntroCall?: () => void;
  contactName: string;
}) {
  const { theme } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen((o) => !o);
  }

  // The menu is portalled to <body> so it clears the card's overflow + stacking
  // context — inline it used to get clipped behind the next contact card. Close
  // on scroll/resize so the fixed menu never drifts away from its button.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
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
      {open && pos && createPortal(
        <div data-theme={theme}>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 1600 }}
          />
          <div
            role="menu"
            style={{
              position: "fixed",
              top: pos.top,
              right: pos.right,
              minWidth: 150,
              padding: 4,
              borderRadius: 10,
              border: "0.5px solid var(--agent-border-default)",
              background: "var(--agent-surface-elevated)",
              boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
              zIndex: 1601,
            }}
          >
            {onIntroCall && (
              <button
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onIntroCall(); }}
                style={menuItemStyle("var(--agent-coral-darker)")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,107,74,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <ClipboardText size={14} weight="regular" />
                Intro call
              </button>
            )}
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
              Remove
            </button>
          </div>
        </div>,
        document.body,
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

// Small animated checkbox for the contact form. The native input stays for
// accessibility and keyboard; the visible box fills coral and the tick draws
// in (and retracts) via stroke-dashoffset when toggled. Colour is the brand
// coral by design. Local to this form; promote to components/ui if reused.
function AnimatedCheckbox({
  checked,
  onChange,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <span className={className} style={{ position: "relative", display: "inline-flex", width: 18, height: 18, flexShrink: 0 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, opacity: 0, cursor: "pointer", zIndex: 1 }}
      />
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: `1.5px solid ${checked ? "var(--agent-coral)" : "var(--agent-border-strong)"}`,
          background: checked ? "var(--agent-coral)" : "transparent",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 160ms ease, border-color 160ms ease",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.4 L4.9 8.8 L9.5 3.4"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 14,
              strokeDashoffset: checked ? 0 : 14,
              transition: "stroke-dashoffset 200ms cubic-bezier(0.65,0,0.35,1) 40ms",
            }}
          />
        </svg>
      </span>
    </span>
  );
}

export function ContactsSection({
  transactionId,
  contacts,
  address = "",
  portalViewDates = {},
  automatedEmailCounts = {},
  lastContactedByContactId = {},
  linkSentByContactId = {},
  whatsappGroupInviteUrl = null,
  photoUrl = null,
  embedded = false,
  isInternalStaff = false,
}: {
  transactionId: string;
  contacts: Contact[];
  // Internal team only: gates the per-contact "Intro call" action in each
  // client card's kebab menu (shown until the file's introduction is done).
  isInternalStaff?: boolean;
  // When true, render without the outer GlassCard shell (the PeoplePanel
  // wrapper provides the card + toggle). 2026-08-10.
  embedded?: boolean;
  address?: string;
  portalViewDates?: Record<string, Date>;
  automatedEmailCounts?: Record<string, number>;
  lastContactedByContactId?: Record<string, string>;
  // Per-contact "a portal-link email has actually been sent to them" signal
  // (resilience audit PR 7). Drives the truthful "Invite sent" vs "Ready to
  // invite" portal state. Absent contacts default to "not sent".
  linkSentByContactId?: Record<string, boolean>;
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
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", roleType: "vendor" as string, isHelper: false, givePortal: false });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  // Intro call: internal-team-only. Launched per client card from the kebab
  // menu; the drawer scopes to that contact's side (vendor -> seller sections,
  // buyer -> buyer sections) but it stays one intro record for the file. We
  // preload the state so the menu item hides once the intro is done.
  const [introData, setIntroData] = useState<IntroCallData | null>(null);
  const [introSide, setIntroSide] = useState<"vendor" | "purchaser" | null>(null);

  const loadIntro = useCallback(async () => {
    if (!isInternalStaff) return;
    try { setIntroData(await getIntroCallDataAction(transactionId)); }
    catch { setIntroData(null); }
  }, [isInternalStaff, transactionId]);

  useEffect(() => { void loadIntro(); }, [loadIntro]);

  async function openIntro(side: "vendor" | "purchaser") {
    await loadIntro(); // refresh to prefill from the latest saved values
    setIntroSide(side);
  }

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
    const isHelper = (form.roleType === "vendor" || form.roleType === "purchaser") && form.isHelper;
    const snap = { propertyTransactionId: transactionId, name: titleCaseKeepAcronyms(form.name), email: form.email.trim().toLowerCase() || null, phone: form.phone.trim() || null, roleType: form.roleType, isPrincipal: !isHelper, portalEligible: isHelper ? form.givePortal : true };
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
    setEditForm({
      name: contact.name,
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      roleType: contact.roleType,
      isHelper: contact.isPrincipal === false,
      givePortal: contact.portalEligible ?? false,
    });
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
    const canHelper = editForm.roleType === "vendor" || editForm.roleType === "purchaser";
    const isHelper = canHelper && editForm.isHelper;
    const snap = {
      id: contactId,
      transactionId,
      name: titleCaseKeepAcronyms(editForm.name),
      phone: editForm.phone.trim() ? normalizePhone(editForm.phone) : null,
      email: editForm.email.trim().toLowerCase() || null,
      // Only send the role flags for a side that can have a helper; leaving
      // them undefined keeps solicitors/brokers untouched (principal default).
      isPrincipal: canHelper ? !isHelper : undefined,
      portalEligible: isHelper ? editForm.givePortal : undefined,
    };
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
  // Roster layout (2026-09): rows are collapsed by default; tapping one expands
  // the full detail (status pills, phone/email, portal card) in place. Nothing
  // is removed — the expanded panel holds everything the old big card showed.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const sortedContacts = [...contacts].sort((a, b) => {
    const oa = ROLE_ORDER[a.roleType] ?? 2;
    const ob = ROLE_ORDER[b.roleType] ?? 2;
    if (oa !== ob) return oa - ob;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Embedded (inside PeoplePanel): no own GlassCard — the wrapper provides
  // the card + toggle. Standalone: keep the contacts-card glass shell.
  const shell = (children: React.ReactNode) =>
    embedded ? (
      <div className="overflow-hidden">{children}</div>
    ) : (
      <GlassCard glassId="contacts-card" label="Contacts card" defaultVariant="v05" className="overflow-hidden" style={{ borderRadius: 12 }}>
        {children}
      </GlassCard>
    );

  return shell(
    <>
      {/* Header — 2026-08-11 feedback, item 5: the property photo IS the
          card's icon (the little house tile went), the title block top-
          aligns against the photo, and the right-side actions stack with
          Add contact on top. When a group link is saved the WhatsApp
          button opens the group directly; the pencil beside it manages
          the link. */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          {/* Property photo moved to the file hero (2026-08-21) — the large
              circular upload lives there now. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", gap: 6, flexShrink: 0 }}>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="agent-btn agent-btn-sm agent-btn-primary"
              style={{ flex: 1 }}
            >
              + Add contact
            </button>
          )}
          {whatsappGroupInviteUrl ? (
            <div style={{ display: "flex", alignItems: "stretch", gap: 6, flex: 1 }}>
              <a
                href={whatsappGroupInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, flex: 1 }}
                title="Open the WhatsApp group"
              >
                <WhatsappLogo size={13} weight="fill" style={{ color: "#25D366" }} />
                WhatsApp group
              </a>
              <button
                type="button"
                onClick={() => setWhatsappOpen(true)}
                className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px" }}
                aria-label="Change the WhatsApp group link"
                title="Change the WhatsApp group link"
              >
                <PencilSimple size={12} weight="regular" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setWhatsappOpen(true)}
              className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, flex: 1 }}
              title="Set up a WhatsApp group for this sale"
            >
              <WhatsappLogo size={13} weight="fill" style={{ color: "#25D366" }} />
              <span className="contacts-wagroup-full">Set up WhatsApp group</span>
              <span className="contacts-wagroup-short">WhatsApp group</span>
            </button>
          )}
        </div>
      </div>

      {/* Add contact form — above the cards so it's visible the moment Add is
          pressed (it used to render below the list, off-screen). Fades in. */}
      {showForm && (
        <div className="agent-reveal-in p-5 border-b border-white/20">
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

            {(form.roleType === "vendor" || form.roleType === "purchaser") && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2.5">
                <label className="flex items-start justify-between gap-2.5 text-[12px] text-slate-700 cursor-pointer">
                  <span>They&rsquo;re helping on the {form.roleType === "vendor" ? "seller" : "buyer"}&rsquo;s behalf, rather than being the {form.roleType === "vendor" ? "seller" : "buyer"} themselves (for example, a relative, assistant or representative). Their name won&rsquo;t appear in confirmations.</span>
                  <AnimatedCheckbox checked={form.isHelper} onChange={(v) => setForm((p) => ({ ...p, isHelper: v }))} className="mt-0.5" />
                </label>
                {form.isHelper && (
                  <label className="flex items-start justify-between gap-2.5 text-[12px] text-slate-700 cursor-pointer pl-[26px]">
                    <span>Give them their own portal login so they can follow progress and receive updates directly.</span>
                    <AnimatedCheckbox checked={form.givePortal} onChange={(v) => setForm((p) => ({ ...p, givePortal: v }))} className="mt-0.5" />
                  </label>
                )}
              </div>
            )}

            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); setForm(EMPTY_FORM); }}
                className="agent-btn agent-btn-sm agent-btn-ghost"
              >
                Cancel
              </button>
              <button type="submit" disabled={loading || isPending} className="agent-btn agent-btn-sm agent-btn-primary">
                {loading ? "Adding…" : "Add contact"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contact cards, stacked full-width */}
      {sortedContacts.length > 0 && (
        <div style={{ padding: "4px 12px 12px" }}>
          {sortedContacts.map((contact, idx) => {
            const role = contact.roleType as ContactRole;
            const r = asRole(role) ?? "other";
            const isEditing = editingId === contact.id;
            const isExiting = exitingId === contact.id;
            const lastViewed = portalViewDates[contact.id];
            const portalState = resolvePortalState(contact, lastViewed, !!linkSentByContactId[contact.id]);
            const optedOut = contact.unsubscribedAt != null;
            const autoCount = automatedEmailCounts[contact.id] ?? 0;
            const autoTone = autoEmailTone(autoCount);
            const expanded = expandedIds.has(contact.id);
            // Portal status dot on the collapsed row (full portal card lives in
            // the expanded panel).
            const dotColor =
              portalState === "active" ? "var(--agent-success)"
              : portalState === "invited" ? "var(--agent-warning)"
              : portalState === "ready_to_invite" || portalState === "link_ready" ? "var(--agent-text-muted)"
              : "transparent";

            return (
              <div
                key={contact.id}
                style={{ borderTop: idx > 0 ? "0.5px solid var(--agent-border-default)" : undefined }}
              >
                {!isEditing && !isExiting && (
                  <>
                    {/* Compact roster row — tap the identity area to expand */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px" }}>
                      <button
                        type="button"
                        onClick={() => toggleExpand(contact.id)}
                        aria-expanded={expanded}
                        style={{ display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                      >
                        <ContactAvatar contact={contact} size={40} art />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            <span data-sensitive="true" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{contact.name}</span>
                            <Pill glass tone={roleTone(r)} size="sm">
                              {roleLabel(r)}
                            </Pill>
                            {contact.isPrincipal === false && (
                              <Pill glass tone="muted" size="sm" title="A helper (not the actual client). We never name them in confirmations.">
                                Helper
                              </Pill>
                            )}
                          </div>
                          {(() => {
                            // Show ONE detail under the name — phone if we have
                            // it, else email — with a matching icon. The other
                            // detail (if any) shows in the expanded panel, so
                            // it's never printed twice.
                            const primary = contact.phone || contact.email;
                            if (!primary) {
                              return <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}>No contact details on file</div>;
                            }
                            const PrimaryIcon = contact.phone ? Phone : EnvelopeSimple;
                            return (
                              <div data-sensitive="true" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", marginTop: 1 }}>
                                <PrimaryIcon size={11} weight="regular" style={{ flexShrink: 0 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{primary}</span>
                              </div>
                            );
                          })()}
                        </div>
                        {dotColor !== "transparent" && (
                          <span title={`Portal ${portalState.replace(/_/g, " ")}`} style={{ width: 7, height: 7, borderRadius: 999, background: dotColor, flexShrink: 0 }} />
                        )}
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ flexShrink: 0, color: "var(--agent-text-muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }}>
                          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {/* Comms + kebab stay on the row (never hidden) */}
                      <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                        <CommsButton compact href={contact.phone ? `tel:${contact.phone}` : undefined} label="Call" icon={<Phone size={15} weight="regular" />} disabled={!contact.phone} title={contact.phone ? "Call" : "No phone number on file"} />
                        <CommsButton compact href={contact.phone ? whatsappHref(contact.phone) : undefined} label="WhatsApp" icon={<ChatCircleText size={15} weight="regular" />} disabled={!contact.phone} title={contact.phone ? "WhatsApp" : "No phone number on file"} />
                        <CommsButton compact href={contact.email ? emailHref(contact.email, contact.roleType, address) : undefined} label="Email" icon={<EnvelopeSimple size={15} weight="regular" />} disabled={!contact.email} title={contact.email ? (optedOut ? "Client has opted out. Send manually with care." : "Email") : "No email on file"} />
                        <RowKebab
                          contactName={contact.name}
                          onEdit={() => startEdit(contact)}
                          onDelete={() => requestDelete(contact)}
                          onIntroCall={
                            isInternalStaff && (role === "vendor" || role === "purchaser") && !introData?.introDone
                              ? () => void openIntro(role as "vendor" | "purchaser")
                              : undefined
                          }
                        />
                      </div>
                    </div>

                    {/* Expanded detail — everything the old card showed */}
                    <div className={`agent-acc${expanded ? " open" : ""}`}>
                      <div className="agent-acc-in">
                      <div style={{ padding: "0 2px 12px 52px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {(lastContactedByContactId[contact.id] || autoTone || optedOut) && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <LastContactedPill lastContactedAt={lastContactedByContactId[contact.id]} />
                            {autoTone && (
                              <Pill
                                glass size="sm"
                                tone={autoCount >= AUTO_EMAIL_RED_AT ? "danger" : autoCount >= AUTO_EMAIL_AMBER_AT ? "warning" : "muted"}
                                title={autoCount >= AUTO_EMAIL_RED_AT
                                  ? `${autoCount} automated chase email${autoCount === 1 ? "" : "s"} sent to this contact in the last 7 days. Likely over-chasing, consider pausing client emails`
                                  : autoCount >= AUTO_EMAIL_AMBER_AT
                                    ? `${autoCount} automated chase email${autoCount === 1 ? "" : "s"} sent to this contact in the last 7 days. Review the chase cadence`
                                    : `${autoCount} automated chase email${autoCount === 1 ? "" : "s"} sent to this contact in the last 7 days`}
                              >
                                <Envelope size={11} weight="fill" />
                                {`${autoCount} chase${autoCount === 1 ? "" : "s"} this week`}
                              </Pill>
                            )}
                            {optedOut && (
                              <Pill glass tone="muted" size="sm" title="This client has opted out of automated emails via the unsubscribe link.">
                                Opted out
                              </Pill>
                            )}
                          </div>
                        )}
                        {/* Only the SECONDARY detail here — email, shown when a
                            phone is already under the name (so nothing repeats).
                            When email is the only detail it's under the name and
                            nothing shows here. Actions stay on the comms icons. */}
                        {contact.phone && contact.email && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <EnvelopeSimple size={13} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
                            <a data-sensitive="true" href={emailHref(contact.email, contact.roleType, address)} className="agent-link agent-link-muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.email}</a>
                          </div>
                        )}
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
                    </div>
                  </>
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
                    {(editForm.roleType === "vendor" || editForm.roleType === "purchaser") && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2.5">
                        <label className="flex items-start justify-between gap-2.5 text-[12px] text-slate-700 cursor-pointer">
                          <span>They&rsquo;re helping on the {editForm.roleType === "vendor" ? "seller" : "buyer"}&rsquo;s behalf, rather than being the {editForm.roleType === "vendor" ? "seller" : "buyer"} themselves (for example, a relative, assistant or representative). Their name won&rsquo;t appear in confirmations.</span>
                          <AnimatedCheckbox checked={editForm.isHelper} onChange={(v) => setEditForm((f) => ({ ...f, isHelper: v }))} className="mt-0.5" />
                        </label>
                        {editForm.isHelper && (
                          <label className="flex items-start justify-between gap-2.5 text-[12px] text-slate-700 cursor-pointer pl-[26px]">
                            <span>Give them their own portal login so they can follow progress and receive updates directly.</span>
                            <AnimatedCheckbox checked={editForm.givePortal} onChange={(v) => setEditForm((f) => ({ ...f, givePortal: v }))} className="mt-0.5" />
                          </label>
                        )}
                      </div>
                    )}
                    {editError && editingId === contact.id && (
                      <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
                        {editError}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 2, justifyContent: "flex-end" }}>
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

      {/* Add contact form now renders above the cards — see the header area. */}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <Modal
          open={true}
          onClose={() => { if (!deleting) setConfirmDelete(null); }}
          size="sm"
          ariaLabel="Remove contact"
          closeTone="onDark"
        >
          <Modal.Header style={SHEET_BAND_STYLE}>
            <SheetBandHeader kicker="Contact" title="Remove contact" />
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

      {/* Intro call drawer (internal team), scoped to the launching side */}
      {introSide && introData && !introData.introDone && (
        <IntroCallDrawer
          data={introData}
          focusSide={introSide}
          onClose={() => setIntroSide(null)}
          onCompleted={() => { setIntroSide(null); setIntroData((d) => (d ? { ...d, introDone: true } : d)); }}
        />
      )}

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
    </>
  );
}
