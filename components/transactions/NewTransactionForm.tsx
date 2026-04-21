"use client";
// components/transactions/NewTransactionForm.tsx

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Tenure, PurchaseType } from "@prisma/client";
import { SolicitorPicker, type SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import { titleCase, normalizePhone } from "@/lib/utils";

type ContactEntry = { name: string; phone: string; email: string };

function emptyContact(): ContactEntry {
  return { name: "", phone: "", email: "" };
}

export function NewTransactionForm({ userRole, redirectBase = "/transactions" }: { userRole?: string; redirectBase?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const isAgent = userRole === "negotiator";
  const [progressedBy, setProgressedBy] = useState<"progressor" | "agent">("progressor");
  const [form, setForm] = useState({
    streetAddress: "",
    city: "",
    postcode: "",
    purchasePrice: "",
    tenure: "" as Tenure | "",
    purchaseType: "" as PurchaseType | "",
    notes: "",
  });

  const [vendors, setVendors] = useState<ContactEntry[]>([emptyContact()]);
  const [purchasers, setPurchasers] = useState<ContactEntry[]>([emptyContact()]);
  const [vendorSolicitor, setVendorSolicitor] = useState<SolicitorSelection | null>(null);
  const [purchaserSolicitor, setPurchaserSolicitor] = useState<SolicitorSelection | null>(null);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateContact(list: ContactEntry[], setList: (v: ContactEntry[]) => void, index: number, field: keyof ContactEntry, value: string) {
    setList(list.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addContact(list: ContactEntry[], setList: (v: ContactEntry[]) => void) {
    if (list.length < 2) setList([...list, emptyContact()]);
  }

  function removeContact(list: ContactEntry[], setList: (v: ContactEntry[]) => void, index: number) {
    setList(list.filter((_, i) => i !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!form.streetAddress || !form.tenure || !form.purchaseType) return;
    submittingRef.current = true;
    setLoading(true);

    const address = [form.streetAddress, form.city, form.postcode].filter(Boolean).join(", ");
    const purchasePrice = form.purchasePrice
      ? Math.round(parseFloat(form.purchasePrice.replace(/,/g, "")) * 100)
      : null;

    const contacts = [
      ...vendors.filter((v) => v.name.trim()).map((v) => ({
        name: titleCase(v.name),
        phone: v.phone.trim() ? normalizePhone(v.phone) : "",
        email: v.email.trim(),
        roleType: "vendor" as const,
      })),
      ...purchasers.filter((p) => p.name.trim()).map((p) => ({
        name: titleCase(p.name),
        phone: p.phone.trim() ? normalizePhone(p.phone) : "",
        email: p.email.trim(),
        roleType: "purchaser" as const,
      })),
    ];

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyAddress: address,
        purchasePrice,
        tenure: form.tenure || null,
        purchaseType: form.purchaseType || null,
        notes: form.notes.trim() || null,
        progressedBy: isAgent ? progressedBy : "progressor",
        contacts,
        vendorSolicitorFirmId: vendorSolicitor?.firmId ?? null,
        vendorSolicitorContactId: vendorSolicitor?.contactId ?? null,
        purchaserSolicitorFirmId: purchaserSolicitor?.firmId ?? null,
        purchaserSolicitorContactId: purchaserSolicitor?.contactId ?? null,
      }),
    });

    if (res.ok) {
      const tx = await res.json();
      sessionStorage.setItem("newTransaction", form.streetAddress || "New file");
      router.push(`${redirectBase}/${tx.id}`);
    } else {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  const hasVendor = vendors.some((v) => v.name.trim());
  const hasPurchaser = purchasers.some((p) => p.name.trim());
  const requiresContacts = isAgent && progressedBy === "progressor";
  const canSubmit = !!form.streetAddress && !!form.tenure && !!form.purchaseType &&
    (!requiresContacts || (hasVendor && hasPurchaser));

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Left: property details + notes ─────────────────────────── */}
        <div className="glass-card p-6 space-y-6">

          {/* Address */}
          <div>
            <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">Property Address</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-900/60 mb-1.5">Street address <span className="text-red-400">*</span></label>
                <input
                  value={form.streetAddress}
                  onChange={(e) => setField("streetAddress", e.target.value)}
                  placeholder="e.g. 14 Elmwood Avenue"
                  className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-900/60 mb-1.5">City / Town</label>
                  <input
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                    placeholder="e.g. Bristol"
                    className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-900/60 mb-1.5">Postcode</label>
                  <input
                    value={form.postcode}
                    onChange={(e) => setField("postcode", e.target.value.toUpperCase())}
                    placeholder="e.g. BS6 7TH"
                    className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tenure */}
          <div>
            <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">Tenure <span className="text-red-400">*</span></h2>
            <div className="flex gap-3">
              {([["freehold", "Freehold", "Management pack not required"], ["leasehold", "Leasehold", "Management pack required"]] as [Tenure, string, string][]).map(([value, label, note]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField("tenure", value)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    form.tenure === value
                      ? "border-blue-400 bg-blue-50/60 text-blue-700"
                      : "border-white/30 text-slate-900/50 hover:border-white/50"
                  }`}
                >
                  {label}
                  <p className="text-xs font-normal text-slate-900/40 mt-0.5">{note}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Purchase type */}
          <div>
            <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">Purchase Type <span className="text-red-400">*</span></h2>
            <div className="flex gap-3">
              {([
                ["mortgage", "Mortgage", "All mortgage milestones apply"],
                ["cash", "Cash", "Mortgage milestones not required"],
                ["cash_from_proceeds", "Cash from Proceeds", "Mortgage + deposit not required"],
              ] as [PurchaseType, string, string][]).map(([value, label, note]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField("purchaseType", value)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    form.purchaseType === value
                      ? "border-blue-400 bg-blue-50/60 text-blue-700"
                      : "border-white/30 text-slate-900/50 hover:border-white/50"
                  }`}
                >
                  {label}
                  <p className="text-xs font-normal text-slate-900/40 mt-0.5">{note}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Purchase price */}
          <div>
            <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">Purchase Price</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-900/50 font-medium">£</span>
              <input
                type="number"
                value={form.purchasePrice}
                onChange={(e) => setField("purchasePrice", e.target.value)}
                placeholder="e.g. 325000"
                className="w-48 px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400"
              />
              <span className="text-xs text-slate-900/40">Optional</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">Notes</h2>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Any context about this transaction…"
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
            />
          </div>

          {/* Who progresses? — agents only */}
          {isAgent && (
            <div>
              <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">Who will progress this file?</h2>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProgressedBy("progressor")}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                    progressedBy === "progressor"
                      ? "border-blue-400 bg-blue-50/60 text-blue-700"
                      : "border-white/30 text-slate-900/50 hover:border-white/50"
                  }`}
                >
                  Send to progressor
                  <p className="text-xs font-normal text-slate-900/40 mt-0.5">Hand off to the progression team</p>
                </button>
                <button
                  type="button"
                  onClick={() => setProgressedBy("agent")}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                    progressedBy === "agent"
                      ? "border-emerald-400 bg-emerald-50/60 text-emerald-700"
                      : "border-white/30 text-slate-900/50 hover:border-white/50"
                  }`}
                >
                  Self-progress
                  <p className="text-xs font-normal text-slate-900/40 mt-0.5">You manage this file yourself</p>
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating…" : "Create transaction"}
            </button>
            {!canSubmit && (
              <p className="text-xs text-slate-900/40 mt-2">
                {requiresContacts && !hasVendor && !hasPurchaser
                  ? "Add at least one vendor and one purchaser before sending to a progressor"
                  : requiresContacts && !hasVendor
                  ? "Add at least one vendor before sending to a progressor"
                  : requiresContacts && !hasPurchaser
                  ? "Add at least one purchaser before sending to a progressor"
                  : "Address, tenure and purchase type are required"}
              </p>
            )}
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Contacts card */}
          <div className="glass-card p-6 space-y-6">
            <ContactSection
              label="Vendors"
              contacts={vendors}
              onChange={(i, f, v) => updateContact(vendors, setVendors, i, f, v)}
              onAdd={() => addContact(vendors, setVendors)}
              onRemove={(i) => removeContact(vendors, setVendors, i)}
            />
            <div className="border-t border-white/20" />
            <ContactSection
              label="Purchasers"
              contacts={purchasers}
              onChange={(i, f, v) => updateContact(purchasers, setPurchasers, i, f, v)}
              onAdd={() => addContact(purchasers, setPurchasers)}
              onRemove={(i) => removeContact(purchasers, setPurchasers, i)}
            />
          </div>

          {/* Solicitors card */}
          <div className="glass-card p-6 space-y-6">
            <div>
              <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-1">Solicitors</h2>
              <p className="text-xs text-slate-900/30 mb-5">Firms are saved and reused across transactions</p>
              <div className="space-y-6">
                <SolicitorPicker label="Seller's Solicitor" value={vendorSolicitor} onChange={setVendorSolicitor} />
                <div className="border-t border-white/20" />
                <SolicitorPicker label="Buyer's Solicitor" value={purchaserSolicitor} onChange={setPurchaserSolicitor} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </form>
  );
}

type ContactSectionProps = {
  label: string;
  contacts: ContactEntry[];
  onChange: (index: number, field: keyof ContactEntry, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

function ContactSection({ label, contacts, onChange, onAdd, onRemove }: ContactSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide">{label}</h2>
        {contacts.length < 2 && (
          <button
            type="button"
            onClick={onAdd}
            className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add {label.slice(0, -1).toLowerCase()}
          </button>
        )}
      </div>
      <div className="space-y-4">
        {contacts.map((contact, i) => (
          <div key={i} className="rounded-lg border border-white/20 p-4 space-y-3 bg-white/20">
            {contacts.length > 1 && (
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-900/50">{label.slice(0, -1)} {i + 1}</span>
                <button type="button" onClick={() => onRemove(i)} className="text-xs text-slate-900/40 hover:text-red-500 transition-colors">
                  Remove
                </button>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-900/60 mb-1.5">Full name <span className="text-red-400">*</span></label>
              <input
                value={contact.name}
                onChange={(e) => onChange(i, "name", e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-900/60 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => onChange(i, "phone", e.target.value)}
                  placeholder="e.g. 07700 900000"
                  className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-900/60 mb-1.5">Email</label>
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => onChange(i, "email", e.target.value)}
                  placeholder="e.g. john@email.com"
                  className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
