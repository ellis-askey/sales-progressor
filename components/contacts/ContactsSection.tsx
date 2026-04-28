"use client";
// components/contacts/ContactsSection.tsx
// Shows existing contacts and an inline form to add new ones.
// Light theme. Applies titleCase to contact names before saving.

import { useState, useTransition } from "react";
import { CONTACT_ROLES, CONTACT_ROLE_LABELS, titleCase, normalizePhone } from "@/lib/utils";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { createContactAction, updateContactAction, deleteContactAction, generatePortalTokenAction } from "@/app/actions/contacts";

function whatsappHref(phone: string): string {
  let digits = phone.replace(/[\s\-().+]/g, "");
  if (digits.startsWith("07")) digits = "44" + digits.slice(1);
  else if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  return `whatsapp://send?phone=${digits}`;
}
import { EmptyState } from "@/components/ui/EmptyState";
import type { ContactRole } from "@prisma/client";
import { EnvelopeSimple, WhatsappLogo } from "@phosphor-icons/react";

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

/** Avatar colour per role */
const ROLE_AVATAR: Record<ContactRole, string> = {
  vendor:    "bg-blue-100 text-blue-600",
  purchaser: "bg-emerald-100 text-emerald-700",
  solicitor: "bg-violet-100 text-violet-700",
  broker:    "bg-amber-100 text-amber-700",
  other:     "bg-white/20 text-slate-900/50",
};

/** Light badge per contact role */
const ROLE_BADGE: Record<ContactRole, string> = {
  vendor:    "bg-blue-50    text-blue-600   border-blue-100",
  purchaser: "bg-green-50   text-green-700  border-green-100",
  solicitor: "bg-violet-50  text-violet-700 border-violet-100",
  broker:    "bg-amber-50   text-amber-700  border-amber-100",
  other:     "bg-white/20   text-slate-900/50 border-white/20",
};

export function ContactsSection({
  transactionId,
  contacts,
  portalViewDates = {},
}: {
  transactionId: string;
  contacts: Contact[];
  portalViewDates?: Record<string, Date>;
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
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "" });
  const [editSaving, setEditSaving] = useState(false);
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

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setShowForm(false);
    const snap = { propertyTransactionId: transactionId, name: titleCase(form.name), email: form.email.trim() || null, phone: form.phone.trim() || null, roleType: form.roleType };
    setForm(EMPTY_FORM);
    startTransition(async () => {
      try {
        await createContactAction(snap);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setShowForm(true);
      } finally {
        setLoading(false);
      }
    });
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setEditForm({ name: contact.name, phone: contact.phone ?? "", email: contact.email ?? "" });
  }

  function handleEdit(contactId: string) {
    setEditSaving(true);
    setEditingId(null);
    const snap = { id: contactId, transactionId, name: titleCase(editForm.name), phone: editForm.phone.trim() ? normalizePhone(editForm.phone) : null, email: editForm.email.trim() || null };
    startTransition(async () => {
      try {
        await updateContactAction(snap);
      } catch {
        setEditingId(contactId);
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
    <section>
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900/40">Contacts</h2>
          {contacts.length > 0 && (
            <span className="text-xs bg-white/30 text-slate-900/50 rounded-full px-2 py-0.5 font-medium">
              {contacts.length}
            </span>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold text-slate-900/60 hover:text-slate-900/90 transition-colors"
          >
            + Add contact
          </button>
        )}
      </div>

      {/* ── Existing contacts ────────────────────────────────────────────── */}
      {contacts.length > 0 && (
        <div className="glass-card mb-4">
          {contacts.map((contact, i) => {
            const role = contact.roleType as ContactRole;
            const initials = contact.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            const isEditing = editingId === contact.id;
            return (
              <div
                key={contact.id}
                className={`px-5 py-4 ${i !== contacts.length - 1 ? "border-b border-white/15" : ""}`}
              >
                {isEditing ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Full name"
                        className="glass-input px-2 py-1.5 text-sm"
                      />
                      <input
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        className="glass-input px-2 py-1.5 text-sm"
                      />
                      <input
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="Email"
                        className="glass-input px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(contact.id)}
                        disabled={editSaving || !editForm.name.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                      >
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs text-slate-900/50 hover:text-slate-900/80 rounded-lg hover:bg-white/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3.5">
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold mt-0.5 ${ROLE_AVATAR[role] ?? "bg-white/20 text-slate-900/50"}`}>
                      {initials}
                    </div>
                    {/* Info + actions */}
                    <div className="flex-1 min-w-0">
                      {/* Name row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span data-sensitive="true" className="text-sm font-semibold text-slate-900/90">{contact.name}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_BADGE[role] ?? "bg-white/20 text-slate-900/50 border-white/20"}`}>
                          {CONTACT_ROLE_LABELS[role]}
                        </span>
                        {contact.portalToken && portalViewDates[contact.id] && (
                          <span className="text-[10px] text-slate-900/35 ml-auto">
                            Viewed {fmtRelative(portalViewDates[contact.id])}
                          </span>
                        )}
                      </div>
                      {/* Contact details */}
                      <div className="flex flex-col gap-0.5 mb-2.5">
                        {contact.email && (
                          <a data-sensitive="true" href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-slate-900/40 hover:text-blue-500 transition-colors">
                            <EnvelopeSimple className="w-3 h-3 flex-shrink-0" weight="regular" />
                            <span className="truncate">{contact.email}</span>
                          </a>
                        )}
                        {contact.phone && (
                          <a data-sensitive="true" href={whatsappHref(contact.phone)} className="flex items-center gap-1.5 text-xs text-slate-900/40 hover:text-green-600 transition-colors">
                            <WhatsappLogo className="w-3 h-3 flex-shrink-0" weight="regular" />
                            {contact.phone}
                          </a>
                        )}
                      </div>
                      {/* Action buttons row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Portal actions */}
                        {(role === "vendor" || role === "purchaser") && (
                          contact.portalToken ? (
                            <>
                              {contact.email && (
                                <button
                                  onClick={() => sendInvite(contact.portalToken!, contact.id)}
                                  disabled={inviting === contact.id}
                                  className="text-xs text-emerald-600 hover:text-emerald-700 transition-colors whitespace-nowrap disabled:opacity-50"
                                >
                                  {inviteSent === contact.id ? "✓ Sent" : inviting === contact.id ? "Sending…" : "Send invite"}
                                </button>
                              )}
                              <button
                                onClick={() => copyPortalLink(contact.portalToken!)}
                                className="text-xs text-[#3a7bd5] hover:text-blue-700 transition-colors whitespace-nowrap"
                                title="Copy portal link"
                              >
                                {copied === contact.portalToken ? "✓ Copied" : "Portal link"}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setupPortalToken(contact.id)}
                              disabled={generatingToken === contact.id}
                              className="text-xs text-slate-900/40 hover:text-blue-500 transition-colors whitespace-nowrap disabled:opacity-40"
                            >
                              {generatingToken === contact.id ? "Setting up…" : "Set up portal"}
                            </button>
                          )
                        )}
                        {/* Divider */}
                        <span className="text-slate-900/15 text-xs">·</span>
                        <button
                          onClick={() => startEdit(contact)}
                          className="text-xs text-slate-900/40 hover:text-slate-900/70 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          disabled={deleting === contact.id}
                          className="text-xs text-slate-900/30 hover:text-red-400 transition-colors disabled:opacity-40"
                        >
                          {deleting === contact.id ? "…" : "Remove"}
                        </button>
                      </div>
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
        <div className="glass-card">
          <EmptyState
            title="No contacts yet"
            description="Add vendors, purchasers, solicitors, and other parties."
            action={
              <button
                onClick={() => setShowForm(true)}
                className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors"
              >
                Add first contact
              </button>
            }
          />
        </div>
      )}

      {/* ── Add contact form ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="glass-card-strong p-5">
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
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-sm font-medium text-white transition-colors shadow-sm"
              >
                {loading ? "Adding…" : "Add contact"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); setForm(EMPTY_FORM); }}
                className="px-4 py-2 rounded-lg text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
