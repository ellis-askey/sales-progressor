"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Tenure, PurchaseType } from "@prisma/client";
import { titleCase, normalizePhone } from "@/lib/utils";
import { saveDraftAction, promoteDraftAction } from "@/app/actions/transactions";

const FIELD = "w-full px-4 py-4 text-[16px] rounded-xl bg-white/60 border border-white/30 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400/60 focus:bg-white/80";
const TOGGLE_BASE = "flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-semibold border-2 transition-all";
const TOGGLE_ON   = "border-blue-500 bg-blue-500 text-white shadow-sm";
const TOGGLE_OFF  = "border-white/30 bg-white/40 text-slate-600 hover:bg-white/60";

type InitialValues = {
  address?: string;
  tenure?: Tenure | null;
  purchaseType?: PurchaseType | null;
  purchasePrice?: number | null;
  vendorName?: string;
  vendorPhone?: string | null;
  purchaserName?: string;
  purchaserPhone?: string | null;
};

export function QuickAddForm({
  initialValues,
  draftId: initialDraftId,
}: {
  initialValues?: InitialValues;
  draftId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState("");
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);

  const [address, setAddress] = useState(initialValues?.address ?? "");
  const [tenure, setTenure] = useState<Tenure | "">(initialValues?.tenure ?? "");
  const [purchaseType, setPurchaseType] = useState<PurchaseType | "">(initialValues?.purchaseType ?? "");
  const [vendorName, setVendorName] = useState(initialValues?.vendorName ?? "");
  const [vendorPhone, setVendorPhone] = useState(initialValues?.vendorPhone ?? "");
  const [purchaserName, setPurchaserName] = useState(initialValues?.purchaserName ?? "");
  const [purchaserPhone, setPurchaserPhone] = useState(initialValues?.purchaserPhone ?? "");
  const [price, setPrice] = useState(
    initialValues?.purchasePrice
      ? (initialValues.purchasePrice / 100).toLocaleString("en-GB")
      : ""
  );

  const parsedPrice = price.trim()
    ? Math.round(parseFloat(price.replace(/,/g, "")) * 100)
    : null;

  async function saveDraft() {
    if (!address.trim()) return;
    setDraftSaving(true);
    setError("");
    try {
      const result = await saveDraftAction({
        draftId: draftId ?? undefined,
        propertyAddress: address.trim(),
        tenure: tenure || null,
        purchaseType: purchaseType || null,
        purchasePrice: parsedPrice,
        vendorName: vendorName.trim() || undefined,
        vendorPhone: vendorPhone.trim() || undefined,
        purchaserName: purchaserName.trim() || undefined,
        purchaserPhone: purchaserPhone.trim() || undefined,
      });
      setDraftId(result.id);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch {
      setError("Couldn't save draft. Try again.");
    } finally {
      setDraftSaving(false);
    }
  }

  async function submit() {
    if (!address.trim() || !tenure || !purchaseType) {
      setError("Please complete all required fields.");
      return;
    }
    setLoading(true);
    setError("");

    const contacts = [
      ...(vendorName.trim() ? [{ name: titleCase(vendorName), phone: vendorPhone.trim() ? normalizePhone(vendorPhone) : null, roleType: "vendor" as const }] : []),
      ...(purchaserName.trim() ? [{ name: titleCase(purchaserName), phone: purchaserPhone.trim() ? normalizePhone(purchaserPhone) : null, roleType: "purchaser" as const }] : []),
    ];

    try {
      if (draftId) {
        const result = await promoteDraftAction(draftId, {
          propertyAddress: address.trim(),
          tenure: tenure as Tenure,
          purchaseType: purchaseType as PurchaseType,
          purchasePrice: parsedPrice,
          contacts,
        });
        router.push(`/agent/transactions/${result.id}`);
      } else {
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyAddress: address.trim(),
            tenure,
            purchaseType,
            contacts,
            purchasePrice: parsedPrice,
            progressedBy: "progressor",
          }),
        });
        if (!res.ok) throw new Error("Failed");
        const { id } = await res.json();
        router.push(`/agent/transactions/${id}`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const hasAddress = address.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="glass-card px-5 py-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40">Property</p>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Full property address…"
          rows={2}
          className={`${FIELD} resize-none`}
          autoFocus
        />
      </div>

      <div className="glass-card px-5 py-5 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40 mb-2">Tenure <span className="text-red-400">*</span></p>
          <div className="flex gap-2">
            <button type="button" className={`${TOGGLE_BASE} ${tenure === "freehold" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setTenure("freehold")}>Freehold</button>
            <button type="button" className={`${TOGGLE_BASE} ${tenure === "leasehold" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setTenure("leasehold")}>Leasehold</button>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40 mb-2">Purchase type <span className="text-red-400">*</span></p>
          <div className="flex gap-2">
            <button type="button" className={`${TOGGLE_BASE} ${purchaseType === "mortgage" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setPurchaseType("mortgage")}>Mortgage</button>
            <button type="button" className={`${TOGGLE_BASE} ${purchaseType === "cash" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setPurchaseType("cash")}>Cash</button>
            <button type="button" className={`${TOGGLE_BASE} ${purchaseType === "cash_from_proceeds" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setPurchaseType("cash_from_proceeds")}>Proceeds</button>
          </div>
        </div>
      </div>

      <div className="glass-card px-5 py-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40">Vendor (optional)</p>
        <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" className={FIELD} />
        <input type="tel" value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} placeholder="Vendor phone" className={FIELD} />
      </div>

      <div className="glass-card px-5 py-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40">Purchaser (optional)</p>
        <input type="text" value={purchaserName} onChange={(e) => setPurchaserName(e.target.value)} placeholder="Purchaser name" className={FIELD} />
        <input type="tel" value={purchaserPhone} onChange={(e) => setPurchaserPhone(e.target.value)} placeholder="Purchaser phone" className={FIELD} />
      </div>

      <div className="glass-card px-5 py-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40">Purchase price (optional)</p>
        <div className="flex items-center gap-2">
          <span className="text-lg text-slate-900/40 font-medium pl-1">£</span>
          <input type="text" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 350,000" className={FIELD} />
        </div>
      </div>

      {error && <p className="text-sm text-red-500 px-1">{error}</p>}

      {hasAddress && (
        <button
          type="button"
          onClick={saveDraft}
          disabled={draftSaving}
          className="w-full py-3.5 rounded-xl text-sm font-semibold border-2 border-slate-200/60 bg-white/40 text-slate-600 hover:bg-white/60 transition-all disabled:opacity-40"
        >
          {draftSaved ? "Draft saved ✓" : draftSaving ? "Saving…" : draftId ? "Update draft" : "Save draft"}
        </button>
      )}

      <button
        onClick={submit}
        disabled={loading || !address.trim() || !tenure || !purchaseType}
        className="w-full py-5 rounded-2xl text-[16px] font-bold text-white transition-all disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37,99,235,0.40)" }}
      >
        {loading ? "Creating file…" : "Create file"}
      </button>

      <p className="text-center text-xs text-slate-900/30 pb-2">
        You can add more details after saving.
      </p>
    </div>
  );
}
