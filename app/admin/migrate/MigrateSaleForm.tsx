"use client";

// Admin-only migration form. Single long sectioned form. On submit:
//   1. createTransactionAction with migrationCreatedAt / migrationAgencyId /
//      migrationAssignedUserId set (admin-gated server-side).
//   2. migrateCompleteMilestonesAction with every ticked milestone's date.
//   3. Both steps complete → reset form for the next file.
// Throwaway page — minimal styling, function over polish.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTransactionAction } from "@/app/actions/transactions";
import { migrateCompleteMilestonesAction } from "@/app/actions/milestones";
import type { Tenure, PurchaseType } from "@prisma/client";

type Agency = { id: string; name: string };
type SP = { id: string; name: string; email: string };
type MilestoneDef = {
  id: string;
  code: string;
  name: string;
  side: "vendor" | "purchaser";
  orderIndex: number;
};

type ContactRow = { name: string; phone: string; email: string };
type MilestoneTick = { defId: string; checked: boolean; date: string };

const TODAY = new Date().toISOString().slice(0, 10);
const EMPTY_CONTACT: ContactRow = { name: "", phone: "", email: "" };

export function MigrateSaleForm({
  agencies,
  salesProgressors,
  milestoneDefs,
}: {
  agencies: Agency[];
  salesProgressors: SP[];
  milestoneDefs: MilestoneDef[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ id: string; address: string; applied: number } | null>(null);

  // Section 1: file age + assignment
  const [createdAt, setCreatedAt] = useState(TODAY);
  const [agencyId, setAgencyId] = useState(agencies[0]?.id ?? "");
  const [assignedSpId, setAssignedSpId] = useState(salesProgressors[0]?.id ?? "");
  const [serviceType, setServiceType] = useState<"self_managed" | "outsourced">("outsourced");
  const [progressedBy, setProgressedBy] = useState<"agent" | "progressor">("progressor");

  // Section 2: property + sale details
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [tenure, setTenure] = useState<Tenure | "">("");
  const [isShareOfFreehold, setIsShareOfFreehold] = useState(false);
  const [purchaseType, setPurchaseType] = useState<PurchaseType | "">("");
  const [purchasePriceStr, setPurchasePriceStr] = useState("");
  const [notes, setNotes] = useState("");

  // Section 3: contacts
  const [vendors, setVendors] = useState<ContactRow[]>([{ ...EMPTY_CONTACT }]);
  const [purchasers, setPurchasers] = useState<ContactRow[]>([{ ...EMPTY_CONTACT }]);

  // Section 4: fees (optional, light coverage)
  const [agentFeeAmountStr, setAgentFeeAmountStr] = useState("");
  const [agentFeePercentStr, setAgentFeePercentStr] = useState("");
  const [agentFeeVatInclusive, setAgentFeeVatInclusive] = useState(true);
  const [referralFeeStr, setReferralFeeStr] = useState("");

  // Section 5: milestones already completed
  const vendorDefs = milestoneDefs.filter((m) => m.side === "vendor");
  const purchaserDefs = milestoneDefs.filter((m) => m.side === "purchaser");
  const [vendorTicks, setVendorTicks] = useState<MilestoneTick[]>(
    vendorDefs.map((d) => ({ defId: d.id, checked: false, date: TODAY })),
  );
  const [purchaserTicks, setPurchaserTicks] = useState<MilestoneTick[]>(
    purchaserDefs.map((d) => ({ defId: d.id, checked: false, date: TODAY })),
  );

  function updateContact(list: ContactRow[], setList: (rows: ContactRow[]) => void, idx: number, patch: Partial<ContactRow>) {
    setList(list.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function addContact(list: ContactRow[], setList: (rows: ContactRow[]) => void) {
    setList([...list, { ...EMPTY_CONTACT }]);
  }
  function removeContact(list: ContactRow[], setList: (rows: ContactRow[]) => void, idx: number) {
    setList(list.filter((_, i) => i !== idx));
  }

  function updateTick(list: MilestoneTick[], setList: (rows: MilestoneTick[]) => void, idx: number, patch: Partial<MilestoneTick>) {
    setList(list.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function resetForm() {
    setCreatedAt(TODAY);
    setStreetAddress("");
    setCity("");
    setPostcode("");
    setTenure("");
    setIsShareOfFreehold(false);
    setPurchaseType("");
    setPurchasePriceStr("");
    setNotes("");
    setVendors([{ ...EMPTY_CONTACT }]);
    setPurchasers([{ ...EMPTY_CONTACT }]);
    setAgentFeeAmountStr("");
    setAgentFeePercentStr("");
    setReferralFeeStr("");
    setVendorTicks(vendorDefs.map((d) => ({ defId: d.id, checked: false, date: TODAY })));
    setPurchaserTicks(purchaserDefs.map((d) => ({ defId: d.id, checked: false, date: TODAY })));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);

    if (!agencyId) return setError("Select an agency");
    if (!assignedSpId) return setError("Select a sales progressor");
    if (!streetAddress.trim() || !city.trim() || !postcode.trim()) return setError("Address (street + city + postcode) is required");
    if (!tenure) return setError("Tenure is required");
    if (!purchaseType) return setError("Purchase type is required");
    const cleanedVendors = vendors.filter((c) => c.name.trim());
    const cleanedPurchasers = purchasers.filter((c) => c.name.trim());
    if (cleanedVendors.length === 0) return setError("At least one vendor name is required");
    if (cleanedPurchasers.length === 0) return setError("At least one purchaser name is required");
    if (!createdAt) return setError("Original created date is required");
    const createdAtDate = new Date(createdAt);
    if (Number.isNaN(createdAtDate.getTime())) return setError("Invalid created-at date");
    if (createdAtDate.getTime() > Date.now()) return setError("Created date can't be in the future");

    const contacts = [
      ...cleanedVendors.map((c) => ({ name: c.name.trim(), phone: c.phone.trim() || undefined, email: c.email.trim() || undefined, roleType: "vendor" as const })),
      ...cleanedPurchasers.map((c) => ({ name: c.name.trim(), phone: c.phone.trim() || undefined, email: c.email.trim() || undefined, roleType: "purchaser" as const })),
    ];

    const purchasePricePence = purchasePriceStr.trim() ? Math.round(parseFloat(purchasePriceStr) * 100) : null;
    const agentFeeAmount = agentFeeAmountStr.trim() ? Math.round(parseFloat(agentFeeAmountStr) * 100) : null;
    const agentFeePercent = agentFeePercentStr.trim() ? parseFloat(agentFeePercentStr) : null;
    const referralFee = referralFeeStr.trim() ? Math.round(parseFloat(referralFeeStr) * 100) : null;

    const propertyAddress = [streetAddress.trim(), city.trim(), postcode.trim()].filter(Boolean).join(", ");

    const milestoneCompletions = [
      ...vendorTicks.filter((t) => t.checked && t.date).map((t) => ({ milestoneDefinitionId: t.defId, eventDate: t.date })),
      ...purchaserTicks.filter((t) => t.checked && t.date).map((t) => ({ milestoneDefinitionId: t.defId, eventDate: t.date })),
    ];

    startTransition(async () => {
      try {
        const result = await createTransactionAction({
          propertyAddress,
          purchasePrice: purchasePricePence,
          tenure: tenure as Tenure,
          isShareOfFreehold: tenure === "leasehold" ? isShareOfFreehold : false,
          purchaseType: purchaseType as PurchaseType,
          notes: notes.trim() || null,
          progressedBy,
          contacts,
          vendorSolicitorFirmId: null,
          vendorSolicitorContactId: null,
          purchaserSolicitorFirmId: null,
          purchaserSolicitorContactId: null,
          agentFeeAmount,
          agentFeePercent,
          agentFeeIsVatInclusive: agentFeeAmount != null || agentFeePercent != null ? agentFeeVatInclusive : null,
          referralFee,
          forceCreate: true, // admin migration bypasses duplicate-address guard
          migrationCreatedAt: createdAtDate,
          migrationAgencyId: agencyId,
          migrationAssignedUserId: assignedSpId,
        });

        let applied = 0;
        if (milestoneCompletions.length > 0) {
          const { applied: n } = await migrateCompleteMilestonesAction({
            transactionId: result.id,
            completions: milestoneCompletions,
          });
          applied = n;
        }

        setSuccessInfo({ id: result.id, address: propertyAddress, applied });
        resetForm();
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Migration failed");
      }
    });
  }

  // Service type derives from progressedBy in createTransaction (the service
  // ignores serviceType input). We surface the radio for clarity but the value
  // is implicit. Keep this in sync with lib/services/transactions.ts:712.
  // (No-op for the user; just documents the relationship.)
  void serviceType;
  void setServiceType;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-6">
      {successInfo && (
        <div className="glass-card p-4 rounded-[12px] border-l-4 border-l-green-500 bg-green-50/40">
          <p className="text-sm font-semibold text-green-800">Migrated: {successInfo.address}</p>
          <p className="text-xs text-green-700 mt-1">
            {successInfo.applied} historical milestone{successInfo.applied === 1 ? "" : "s"} backdated.{" "}
            <a className="underline" href={`/agent/transactions/${successInfo.id}`} target="_blank" rel="noreferrer">
              Open file →
            </a>
          </p>
        </div>
      )}

      {/* Section 1: File age + assignment */}
      <Section title="1. File age + assignment">
        <Field label="Original created date" required>
          <input
            type="date"
            value={createdAt}
            max={TODAY}
            onChange={(e) => setCreatedAt(e.target.value)}
            className={INPUT}
            required
          />
          <p className={HINT}>Backdated to the file&apos;s real start date from the old system. Drives weeks-elapsed and the 12-week target.</p>
        </Field>
        <Field label="Agency" required>
          <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className={INPUT} required>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Assigned Sales Progressor" required>
          <select value={assignedSpId} onChange={(e) => setAssignedSpId(e.target.value)} className={INPUT} required>
            {salesProgressors.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
          </select>
        </Field>
        <Field label="Progressed by">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={progressedBy === "progressor"} onChange={() => setProgressedBy("progressor")} />
              Progressor (outsourced)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={progressedBy === "agent"} onChange={() => setProgressedBy("agent")} />
              Agent (self-managed)
            </label>
          </div>
          <p className={HINT}>Determines serviceType. Outsourced = our team progresses; self-managed = agency progresses themselves.</p>
        </Field>
      </Section>

      {/* Section 2: Property + sale details */}
      <Section title="2. Property + sale details">
        <Field label="Street address" required>
          <input value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} className={INPUT} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" required>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={INPUT} required />
          </Field>
          <Field label="Postcode" required>
            <input value={postcode} onChange={(e) => setPostcode(e.target.value)} className={INPUT} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tenure" required>
            <select value={tenure} onChange={(e) => setTenure(e.target.value as Tenure | "")} className={INPUT} required>
              <option value="">— Select —</option>
              <option value="freehold">Freehold</option>
              <option value="leasehold">Leasehold</option>
            </select>
          </Field>
          <Field label="Purchase type" required>
            <select value={purchaseType} onChange={(e) => setPurchaseType(e.target.value as PurchaseType | "")} className={INPUT} required>
              <option value="">— Select —</option>
              <option value="mortgage">Mortgage</option>
              <option value="cash_buyer">Cash buyer</option>
              <option value="cash_from_proceeds">Cash from proceeds</option>
            </select>
          </Field>
        </div>
        {tenure === "leasehold" && (
          <Field label="">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isShareOfFreehold} onChange={(e) => setIsShareOfFreehold(e.target.checked)} />
              Share of freehold
            </label>
          </Field>
        )}
        <Field label="Purchase price (£)">
          <input
            type="number"
            step="1"
            value={purchasePriceStr}
            onChange={(e) => setPurchasePriceStr(e.target.value)}
            placeholder="450000"
            className={INPUT}
          />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={INPUT} rows={3} />
        </Field>
      </Section>

      {/* Section 3: Contacts */}
      <Section title="3. Contacts">
        <ContactList label="Vendor(s)" rows={vendors} onUpdate={(i, p) => updateContact(vendors, setVendors, i, p)} onAdd={() => addContact(vendors, setVendors)} onRemove={(i) => removeContact(vendors, setVendors, i)} />
        <div className="mt-4">
          <ContactList label="Purchaser(s)" rows={purchasers} onUpdate={(i, p) => updateContact(purchasers, setPurchasers, i, p)} onAdd={() => addContact(purchasers, setPurchasers)} onRemove={(i) => removeContact(purchasers, setPurchasers, i)} />
        </div>
      </Section>

      {/* Section 4: Fees (optional) */}
      <Section title="4. Fees (optional)">
        <p className={HINT}>Leave blank if unknown — can be filled in later from the file&apos;s Edit Sale Details drawer.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agent fee — flat (£)">
            <input type="number" step="1" value={agentFeeAmountStr} onChange={(e) => setAgentFeeAmountStr(e.target.value)} className={INPUT} placeholder="e.g. 4500" />
          </Field>
          <Field label="Agent fee — percent (%)">
            <input type="number" step="0.01" value={agentFeePercentStr} onChange={(e) => setAgentFeePercentStr(e.target.value)} className={INPUT} placeholder="e.g. 1.25" />
          </Field>
        </div>
        <Field label="">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agentFeeVatInclusive} onChange={(e) => setAgentFeeVatInclusive(e.target.checked)} />
            Agent fee includes VAT
          </label>
        </Field>
        <Field label="Solicitor referral fee (£)">
          <input type="number" step="1" value={referralFeeStr} onChange={(e) => setReferralFeeStr(e.target.value)} className={INPUT} placeholder="e.g. 200" />
        </Field>
      </Section>

      {/* Section 5: Milestones already completed */}
      <Section title="5. Milestones already completed">
        <p className={HINT}>Tick every milestone the file has already passed in the old system. Set a real-world date per tick. Untick = still pending — the reminder engine will pick them up.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <MilestoneSide label="Vendor side" defs={vendorDefs} ticks={vendorTicks} onUpdate={(i, p) => updateTick(vendorTicks, setVendorTicks, i, p)} />
          <MilestoneSide label="Purchaser side" defs={purchaserDefs} ticks={purchaserTicks} onUpdate={(i, p) => updateTick(purchaserTicks, setPurchaserTicks, i, p)} />
        </div>
      </Section>

      {/* Submit */}
      {error && (
        <div className="glass-card p-4 rounded-[12px] border-l-4 border-l-red-500 bg-red-50/40">
          <p className="text-sm text-red-800 font-medium">{error}</p>
        </div>
      )}
      <div className="flex items-center gap-3 sticky bottom-4 glass-card p-4 rounded-[12px]">
        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#FF6B4A" }}>
          {isPending ? "Migrating…" : "Create migrated file"}
        </button>
        <button type="button" onClick={resetForm} disabled={isPending} className="px-4 py-2 rounded-md text-sm font-semibold border border-slate-300 text-slate-700 disabled:opacity-50">
          Reset
        </button>
        <span className="text-xs text-slate-500 ml-auto">~40 files to go. Submit, success banner appears, form resets, repeat.</span>
      </div>
    </form>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

const INPUT = "w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white";
const HINT = "text-xs text-slate-500 mt-1";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5 rounded-[12px] space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
    </div>
  );
}

function ContactList({ label, rows, onUpdate, onAdd, onRemove }: {
  label: string;
  rows: ContactRow[];
  onUpdate: (idx: number, patch: Partial<ContactRow>) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-700">{label} <span className="text-red-500">*</span></p>
        <button type="button" onClick={onAdd} className="text-xs text-blue-600 font-medium">+ Add</button>
      </div>
      <div className="space-y-2">
        {rows.map((c, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <input className={`${INPUT} col-span-4`} placeholder="Full name" value={c.name} onChange={(e) => onUpdate(i, { name: e.target.value })} />
            <input className={`${INPUT} col-span-3`} placeholder="Phone" value={c.phone} onChange={(e) => onUpdate(i, { phone: e.target.value })} />
            <input className={`${INPUT} col-span-4`} placeholder="Email" value={c.email} onChange={(e) => onUpdate(i, { email: e.target.value })} />
            <button type="button" onClick={() => onRemove(i)} disabled={rows.length === 1} className="col-span-1 text-xs text-slate-500 disabled:opacity-30">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneSide({ label, defs, ticks, onUpdate }: {
  label: string;
  defs: MilestoneDef[];
  ticks: MilestoneTick[];
  onUpdate: (idx: number, patch: Partial<MilestoneTick>) => void;
}) {
  const checkedCount = ticks.filter((t) => t.checked).length;
  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">{checkedCount} ticked</p>
      </div>
      <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
        {defs.map((d, i) => {
          const t = ticks[i];
          if (!t) return null;
          return (
            <div key={d.id} className="flex items-center gap-2 px-3 py-2">
              <input
                type="checkbox"
                checked={t.checked}
                onChange={(e) => onUpdate(i, { checked: e.target.checked })}
                className="flex-shrink-0"
              />
              <span className="text-xs text-slate-400 w-10 flex-shrink-0">{d.code}</span>
              <span className="text-xs text-slate-800 flex-1 min-w-0 truncate">{d.name}</span>
              <input
                type="date"
                value={t.date}
                max={TODAY}
                disabled={!t.checked}
                onChange={(e) => onUpdate(i, { date: e.target.value })}
                className="px-2 py-1 text-xs border border-slate-300 rounded disabled:opacity-30 disabled:bg-slate-50 flex-shrink-0"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
