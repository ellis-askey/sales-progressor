"use client";
// components/contacts/ContactsSection.tsx
// Shows existing contacts and an inline form to add new ones.
// Light theme. Applies titleCase to contact names before saving.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONTACT_ROLES, CONTACT_ROLE_LABELS, titleCase, normalizePhone } from "@/lib/utils";

function whatsappHref(phone: string): string {
  let digits = phone.replace(/[\s\-().+]/g, "");
  if (digits.startsWith("07")) digits = "44" + digits.slice(1);
  else if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  return `whatsapp://send?phone=${digits}`;
}
import { EmptyState } from "@/components/ui/EmptyState";
import type { ContactRole } from "@prisma/client";

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  roleType: string;
  portalToken: string | null;
  createdAt: Date;
};

const EMPTY_FORM = {
  name:     "",
  roleType: "vendor" as ContactRole,
  email:    "",
  phone:    "",
};

const INPUT =
  "w-full px-3 py-2 rounded-lg border border-[#e4e9f0] bg-white text-sm text-gray-800 " +
  "placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all";

const SELECT = INPUT + " pr-8";

/** Avatar colour per role */
const ROLE_AVATAR: Record<ContactRole, string> = {
  vendor:    "bg-blue-100 text-blue-600",
  purchaser: "bg-emerald-100 text-emerald-700",
  solicitor: "bg-violet-100 text-violet-700",
  broker:    "bg-amber-100 text-amber-700",
  other:     "bg-gray-100 text-gray-500",
};

/** Light badge per contact role */
const ROLE_BADGE: Record<ContactRole, string> = {
  vendor:    "bg-blue-50    text-blue-600   border-blue-100",
  purchaser: "bg-green-50   text-green-700  border-green-100",
  solicitor: "bg-violet-50  text-violet-700 border-violet-100",
  broker:    "bg-amber-50   text-amber-700  border-amber-100",
  other:     "bg-gray-50    text-gray-500   border-gray-100",
};

export function ContactsSection({
  transactionId,
  contacts,
}: {
  transactionId: string;
  contacts: Contact[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "" });
  const [editSaving, setEditSaving] = useState(false);

  function copyPortalLink(token: string) {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyTransactionId: transactionId,
          name:     titleCase(form.name),
          email:    form.email.trim() || null,
          phone:    form.phone.trim() || null,
          roleType: form.roleType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add contact");
      setForm(EMPTY_FORM);
      setShowForm(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setEditForm({ name: contact.name, phone: contact.phone ?? "", email: contact.email ?? "" });
  }

  async function handleEdit(contactId: string) {
    setEditSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: contactId,
          name: titleCase(editForm.name),
          phone: editForm.phone.trim() ? normalizePhone(editForm.phone) : null,
          email: editForm.email.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingId(null);
      router.refresh();
    } catch {
      // keep form open on error
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(contactId: string) {
    setDeleting(contactId);
    try {
      const res = await fetch(`/api/contacts?id=${contactId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section>
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Contacts</h2>
          {contacts.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
              {contacts.length}
            </span>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
          >
            + Add contact
          </button>
        )}
      </div>

      {/* ── Existing contacts ────────────────────────────────────────────── */}
      {contacts.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden mb-4"
             style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          {contacts.map((contact, i) => {
            const role = contact.roleType as ContactRole;
            const initials = contact.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            const isEditing = editingId === contact.id;
            return (
              <div
                key={contact.id}
                className={`px-5 py-4 ${i !== contacts.length - 1 ? "border-b border-[#f0f4f8]" : ""}`}
              >
                {isEditing ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Full name"
                        className="px-2 py-1.5 text-sm border border-[#e4e9f0] rounded-lg focus:outline-none focus:border-blue-400"
                      />
                      <input
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        className="px-2 py-1.5 text-sm border border-[#e4e9f0] rounded-lg focus:outline-none focus:border-blue-400"
                      />
                      <input
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="Email"
                        className="px-2 py-1.5 text-sm border border-[#e4e9f0] rounded-lg focus:outline-none focus:border-blue-400"
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
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${ROLE_AVATAR[role] ?? "bg-gray-100 text-gray-500"}`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-semibold text-gray-800">{contact.name}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_BADGE[role] ?? "bg-gray-50 text-gray-500 border-gray-100"}`}>
                            {CONTACT_ROLE_LABELS[role]}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                              </svg>
                              {contact.email}
                            </a>
                          )}
                          {contact.phone && (
                            <a href={whatsappHref(contact.phone)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-600 transition-colors">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                              </svg>
                              {contact.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                      {contact.portalToken && (role === "vendor" || role === "purchaser") && (
                        <button
                          onClick={() => copyPortalLink(contact.portalToken!)}
                          className="text-xs text-[#3a7bd5] hover:text-blue-700 transition-colors whitespace-nowrap"
                          title="Copy portal link"
                        >
                          {copied === contact.portalToken ? "✓ Copied" : "Portal link"}
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(contact)}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        disabled={deleting === contact.id}
                        className="text-xs text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        {deleting === contact.id ? "…" : "Remove"}
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
        <div className="bg-white rounded-xl border border-[#e4e9f0]"
             style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
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
        <div className="bg-white rounded-xl border border-blue-200 p-5"
             style={{ boxShadow: "0 1px 4px rgba(59,130,246,0.08)" }}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New contact</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Full name <span className="text-red-400">*</span>
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
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Role <span className="text-red-400">*</span>
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
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
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
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
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
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-sm font-medium text-white transition-colors shadow-sm"
              >
                {loading ? "Adding…" : "Add contact"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); setForm(EMPTY_FORM); }}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
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
