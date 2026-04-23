"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Tenure, PurchaseType } from "@prisma/client";
import { titleCase, normalizePhone } from "@/lib/utils";

const FIELD = "w-full px-4 py-4 text-[16px] rounded-xl bg-white/60 border border-white/30 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400/60 focus:bg-white/80";
const TOGGLE_BASE = "flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-semibold border-2 transition-all";
const TOGGLE_ON   = "border-blue-500 bg-blue-500 text-white shadow-sm";
const TOGGLE_OFF  = "border-white/30 bg-white/40 text-slate-600 hover:bg-white/60";

export function QuickAddForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const [address, setAddress]   = useState("");
  const [tenure, setTenure]     = useState<Tenure | "">("");
  const [purchaseType, setPurchaseType] = useState<PurchaseType | "">("");
  const [vendorName, setVendorName]   = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [purchaserName, setPurchaserName] = useState("");
  const [purchaserPhone, setPurchaserPhone] = useState("");
  const [price, setPrice] = useState("");

  async function submit() {
    if (!address.trim() || !tenure || !purchaseType) {
      setError("Please complete all required fields.");
      return;
    }
    setLoading(true);
    setError("");

    const contacts = [
      ...(vendorName.trim() ? [{ name: titleCase(vendorName), phone: vendorPhone.trim() ? normalizePhone(vendorPhone) : "", email: "", roleType: "vendor" as const }] : []),
      ...(purchaserName.trim() ? [{ name: titleCase(purchaserName), phone: purchaserPhone.trim() ? normalizePhone(purchaserPhone) : "", email: "", roleType: "purchaser" as const }] : []),
    ];

    const purchasePrice = price.trim()
      ? Math.round(parseFloat(price.replace(/,/g, "")) * 100)
      : null;

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyAddress: address.trim(),
          tenure,
          purchaseType,
          contacts,
          purchasePrice,
          progressedBy: "progressor",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { id } = await res.json();
      router.push(`/agent/transactions/${id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Address */}
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

      {/* Step 2: Tenure + type */}
      <div className="glass-card px-5 py-5 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40 mb-2">Tenure <span className="text-red-400">*</span></p>
          <div className="flex gap-2">
            <button type="button" className={`${TOGGLE_BASE} ${tenure === "freehold" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setTenure("freehold")}>
              Freehold
            </button>
            <button type="button" className={`${TOGGLE_BASE} ${tenure === "leasehold" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setTenure("leasehold")}>
              Leasehold
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40 mb-2">Purchase type <span className="text-red-400">*</span></p>
          <div className="flex gap-2">
            <button type="button" className={`${TOGGLE_BASE} ${purchaseType === "mortgage" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setPurchaseType("mortgage")}>
              Mortgage
            </button>
            <button type="button" className={`${TOGGLE_BASE} ${purchaseType === "cash" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setPurchaseType("cash")}>
              Cash
            </button>
            <button type="button" className={`${TOGGLE_BASE} ${purchaseType === "cash_from_proceeds" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setPurchaseType("cash_from_proceeds")}>
              Proceeds
            </button>
          </div>
        </div>
      </div>

      {/* Step 3: Contacts */}
      <div className="glass-card px-5 py-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40">Vendor (optional)</p>
        <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)}
          placeholder="Vendor name" className={FIELD} />
        <input type="tel" value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)}
          placeholder="Vendor phone" className={FIELD} />
      </div>

      <div className="glass-card px-5 py-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40">Purchaser (optional)</p>
        <input type="text" value={purchaserName} onChange={(e) => setPurchaserName(e.target.value)}
          placeholder="Purchaser name" className={FIELD} />
        <input type="tel" value={purchaserPhone} onChange={(e) => setPurchaserPhone(e.target.value)}
          placeholder="Purchaser phone" className={FIELD} />
      </div>

      {/* Step 4: Price */}
      <div className="glass-card px-5 py-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900/40">Purchase price (optional)</p>
        <div className="flex items-center gap-2">
          <span className="text-lg text-slate-900/40 font-medium pl-1">£</span>
          <input
            type="text"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 350,000"
            className={FIELD}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 px-1">{error}</p>
      )}

      {/* Submit */}
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
