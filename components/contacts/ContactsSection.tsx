"use client";
// components/contacts/ContactsSection.tsx
// Shows existing contacts and an inline form to add new ones.
// Light theme. Applies titleCase to contact names before saving.

import { useState, useTransition } from "react";
import { CONTACT_ROLES, titleCase, normalizePhone } from "@/lib/utils";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { createContactAction, updateContactAction, deleteContactAction, generatePortalTokenAction } from "@/app/actions/contacts";
import { EmptyState } from "@/components/ui/EmptyState";
import { RoleIcon, ROLE_PILL_BG, roleColour, roleLabel, asRole } from "@/components/ui/RoleIcon";
import { Envelope, ArrowSquareOut } from "@phosphor-icons/react";
import type { ContactRole } from "@prisma/client";
import { LastContactedPill } from "./LastContactedPill";
import { ContactRowMenu } from "./ContactRowMenu";

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

// Threshold ladder for the per-contact automated-email pill. The count is
// "chase emails sent to this contact in the rolling 7 days" (see
// getAutomatedEmailCountsByContact in lib/services/comms.ts). With a
// 7-day window the thresholds tighten: 3+ in a week is worth a glance,
// 5+ is approaching daily and likely needs intervention.
const AUTO_EMAIL_AMBER_AT = 3;
const AUTO_EMAIL_RED_AT = 5;

function autoEmailTone(count: number): { bg: string; fg: string } | null {
  if (count <= 0) return null;
  if (count >= AUTO_EMAIL_RED_AT) {
    return { bg: "rgba(var(--agent-danger-rgb), 0.10)", fg: "var(--agent-danger)" };
  }
  if (count >= AUTO_EMAIL_AMBER_AT) {
    return { bg: "rgba(var(--agent-warning-rgb), 0.10)", fg: "var(--agent-warning)" };
  }
  return { bg: "rgba(15,23,42,0.06)", fg: "var(--agent-text-muted)" };
}

export function ContactsSection({
  transactionId,
  contacts,
  address = "",
  portalViewDates = {},
  automatedEmailCounts = {},
  lastContactedByContactId = {},
}: {
  transactionId: string;
  contacts: Contact[];
  address?: string;
  portalViewDates?: Record<string, Date>;
  // Map of contactId -> count of automated emails fired against this file.
  // Hidden when count=0; tone shifts amber at 5, red at 10. Drives the
  // "is this person being over-chased?" signal on each row.
  automatedEmailCounts?: Record<string, number>;
  // Map of contactId -> ISO timestamp of the latest qualifying outbound
  // event for that contact. Missing key = never contacted. Computed by
  // getLastContactedByContact in lib/services/comms.ts. Drives the
  // freshness pill in the secondary row.
  lastContactedByContactId?: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useAgentToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);

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
      await generatePortalTokenAction(contactId, transactionId);
    } finally {
      setGeneratingToken(null);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Translate a server-thrown DUPLICATE_CONTACT_FIELD error into a
  // human-readable line for the inline pill. Falls back to the raw
  // message when the error has a different shape.
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
        // Restore the form values so the agent can edit without retyping
        // and surface the friendly error message.
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
    // Don't close the edit row until we know the save succeeded — that
    // way if the server rejects a duplicate we can render the error pill
    // inline on the still-open row.
    startTransition(async () => {
      try {
        await updateContactAction(snap);
        if (snap.phone || snap.email) {
          window.dispatchEvent(new CustomEvent("sp_onboarding_step", { detail: { hasContactDetails: true } }));
        }
        // Success — animate the edit row closed.
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

  function handleDelete(contactId: string) {
    setDeleting(contactId);
    startTransition(async () => {
      try {
        await deleteContactAction(contactId, transactionId);
      } finally {
        setDeleting(null);
      }
    });
  }

  return (
    <div className="glass-card overflow-hidden rounded-[12px]">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", margin: 0 }}>Contacts</h3>
          {contacts.length > 0 && <span className="agent-badge">{contacts.length}</span>}
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="agent-link" style={{ fontSize: 11 }}>
            + Add contact
          </button>
        )}
      </div>

      {/* Contact rows */}
      {contacts.length > 0 && (
        <div>
          {contacts.map((contact) => {
            const role = contact.roleType as ContactRole;
            const r = asRole(role) ?? "other";
            const isEditing = editingId === contact.id;
            const isExiting = exitingId === contact.id;
            return (
              <div key={contact.id} style={{ borderBottom: "0.5px solid var(--agent-border-default)" }}>
                {/* Display row — always visible */}
                <div className="agent-entity-row" style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Avatar */}
                  <div className="agent-avatar agent-avatar-sm" style={{ flexShrink: 0 }}>{getInitials(contact.name)}</div>

                  {/* Name + contact details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="agent-entity-name-row" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span data-sensitive="true" style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>{contact.name}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, borderRadius: 4, padding: "1px 6px", background: ROLE_PILL_BG[r], color: roleColour(r) }}>
                        <RoleIcon role={r} size={11} />
                        {roleLabel(r)}
                      </span>
                      {contact.portalToken && portalViewDates[contact.id] && (
                        <span style={{ fontSize: 10, color: "var(--agent-text-muted)", marginLeft: "auto" }}>
                          Viewed {fmtRelative(portalViewDates[contact.id])}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {contact.phone && (
                        <a data-sensitive="true" href={whatsappHref(contact.phone)} className="agent-link agent-link-muted" style={{ fontSize: 10 }}>
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a data-sensitive="true" href={emailHref(contact.email, contact.roleType, address)} className="agent-link agent-link-muted" style={{ fontSize: 10 }}>
                          {contact.email}
                        </a>
                      )}
                      <LastContactedPill lastContactedAt={lastContactedByContactId[contact.id]} />
                      {(() => {
                        const n = automatedEmailCounts[contact.id] ?? 0;
                        const tone = autoEmailTone(n);
                        if (!tone) return null;
                        // Count is rolling-7-day chase emails — see
                        // getAutomatedEmailCountsByContact + tooltip below.
                        const label = `${n} chase${n === 1 ? "" : "s"} this week`;
                        const title = n >= AUTO_EMAIL_RED_AT
                          ? `${n} automated chase email${n === 1 ? "" : "s"} sent to this contact in the last 7 days — likely over-chasing; consider pausing client emails`
                          : n >= AUTO_EMAIL_AMBER_AT
                            ? `${n} automated chase email${n === 1 ? "" : "s"} sent to this contact in the last 7 days — review chase cadence`
                            : `${n} automated chase email${n === 1 ? "" : "s"} sent to this contact in the last 7 days`;
                        return (
                          <span
                            title={title}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: tone.bg,
                              color: tone.fg,
                            }}
                          >
                            <Envelope size={11} weight="fill" />
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Action buttons — portal + edit/remove when not editing */}
                  {!isEditing && (
                    <div className="agent-entity-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {(role === "vendor" || role === "purchaser") && (
                        contact.portalToken ? (
                          <>
                            {contact.email && (
                              <button
                                onClick={() => sendInvite(contact.portalToken!, contact.id)}
                                disabled={inviting === contact.id}
                                className="agent-btn agent-btn-xs agent-btn-primary"
                              >
                                {inviteSent === contact.id ? "✓ Sent" : inviting === contact.id ? "Sending…" : "Send invite"}
                              </button>
                            )}
                            <button
                              onClick={() => copyPortalLink(contact.portalToken!)}
                              className="agent-link agent-link-muted"
                              style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 3 }}
                              title="Copy portal link"
                            >
                              {copied === contact.portalToken ? (
                                "✓ Copied"
                              ) : (
                                <>
                                  Portal
                                  <ArrowSquareOut size={11} weight="bold" />
                                </>
                              )}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setupPortalToken(contact.id)}
                            disabled={generatingToken === contact.id}
                            className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                          >
                            {generatingToken === contact.id ? "Setting up…" : "Set up portal"}
                          </button>
                        )
                      )}
                      <ContactRowMenu
                        contactName={contact.name}
                        onEdit={() => startEdit(contact)}
                        onRemove={() => handleDelete(contact.id)}
                      />
                    </div>
                  )}
                </div>

                {/* Edit form — slides in below, always animates out on close */}
                {(isEditing || isExiting) && (
                  <div
                    className={isExiting ? "agent-reveal-out" : "agent-reveal-in"}
                    style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Full name"
                      className="glass-input w-full px-3 py-2 text-sm"
                    />
                    <input
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone"
                      className="glass-input w-full px-3 py-2 text-sm"
                    />
                    <input
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                      className="glass-input w-full px-3 py-2 text-sm"
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

      {/* Empty state (no contacts, no form) */}
      {contacts.length === 0 && !showForm && (
        <EmptyState
          compact
          title="No contacts yet"
          description="Add vendors, purchasers, and other parties."
        />
      )}

      {/* ── Add contact form ─────────────────────────────────────────────── */}
      {showForm && (
        <div className={`p-5${contacts.length > 0 ? " border-t border-white/20" : ""}`}>
          <h3 className="text-sm font-semibold text-slate-900/90 mb-4">New contact</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Full name or company"
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="roleType"
                  value={form.roleType}
                  onChange={handleChange}
                  className={SELECT}
                >
                  {CONTACT_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="07700 900 000"
                  className={INPUT}
                />
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || isPending}
                className="agent-btn agent-btn-sm agent-btn-primary"
              >
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
    </div>
  );
}
