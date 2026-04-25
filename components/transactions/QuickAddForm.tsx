"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Tenure, PurchaseType } from "@prisma/client";
import { titleCase, normalizePhone, normalizePostcode } from "@/lib/utils";
import { saveDraftAction, promoteDraftAction } from "@/app/actions/transactions";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { PriceInput } from "@/components/ui/PriceInput";

const FIELD = "w-full px-3 py-2.5 text-sm rounded-xl bg-white/60 border border-white/30 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400/60 focus:bg-white/80";
const TOGGLE_BASE = "flex-1 flex items-center justify-center py-3.5 rounded-xl text-sm font-semibold border-2 transition-all";
const TOGGLE_ON   = "border-blue-500 bg-blue-500 text-white shadow-sm";
const TOGGLE_OFF  = "border-white/30 bg-white/40 text-slate-600 hover:bg-white/60";
const CARD = "glass-card px-5 py-4 space-y-3";
const LABEL = "text-xs font-bold uppercase tracking-wide text-slate-900/40";

const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s[0-9][A-Z]{2}$/;

function isValidUKPostcode(pc: string) {
  return UK_POSTCODE_RE.test(pc.trim().toUpperCase());
}

function cleanPhone(raw: string) {
  return raw.replace(/[^\d+\s\-()]/g, "").slice(0, 20);
}

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
  const { toast } = useAgentToast();

  const [loading, setLoading] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [draftSaving, setDraftSaving] = useState(false);

  const SUBMIT_MESSAGES = [
    "Creating file…",
    "Setting up milestones…",
    "Taking you to your file…",
  ];

  useEffect(() => {
    if (!loading) { setMsgIndex(0); return; }
    const t = setInterval(() => setMsgIndex((i) => Math.min(i + 1, SUBMIT_MESSAGES.length - 1)), 900);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);
  const [error, setError] = useState("");
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);

  const [street, setStreet] = useState(initialValues?.address ?? "");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [postcodeError, setPostcodeError] = useState("");
  const [tenure, setTenure] = useState<Tenure | "">(initialValues?.tenure ?? "");
  const [purchaseType, setPurchaseType] = useState<PurchaseType | "">(initialValues?.purchaseType ?? "");
  const [progressedBy, setProgressedBy] = useState<"progressor" | "agent">("agent");
  const [vendorName, setVendorName] = useState(initialValues?.vendorName ?? "");
  const [vendorPhone, setVendorPhone] = useState(initialValues?.vendorPhone ?? "");
  const [vendorEmail, setVendorEmail] = useState("");
  const [purchaserName, setPurchaserName] = useState(initialValues?.purchaserName ?? "");
  const [purchaserPhone, setPurchaserPhone] = useState(initialValues?.purchaserPhone ?? "");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [pricePence, setPricePence] = useState<number | null>(initialValues?.purchasePrice ?? null);

  const fullAddress = [titleCase(street.trim()), titleCase(city.trim()), normalizePostcode(postcode.trim())].filter(Boolean).join(", ");
  const hasAddress = street.trim().length > 0;

  const outsourceContactsValid =
    progressedBy !== "progressor" ||
    (
      vendorName.trim() && (vendorPhone.trim() || vendorEmail.trim()) &&
      purchaserName.trim() && (purchaserPhone.trim() || purchaserEmail.trim())
    );

  function handlePostcodeBlur() {
    if (!postcode.trim()) {
      setPostcodeError("");
      return;
    }
    const normalized = normalizePostcode(postcode);
    setPostcode(normalized);
    if (!isValidUKPostcode(normalized)) {
      setPostcodeError("Doesn't look like a valid UK postcode");
    } else {
      setPostcodeError("");
    }
  }

  function clearForm() {
    setStreet("");
    setCity("");
    setPostcode("");
    setPostcodeError("");
    setTenure("");
    setPurchaseType("");
    setVendorName("");
    setVendorPhone("");
    setVendorEmail("");
    setPurchaserName("");
    setPurchaserPhone("");
    setPurchaserEmail("");
    setPricePence(null);
    setDraftId(null);
    setProgressedBy("progressor");
  }

  async function saveDraft() {
    if (!hasAddress) return;
    setDraftSaving(true);
    setError("");
    try {
      const result = await saveDraftAction({
        draftId: draftId ?? undefined,
        propertyAddress: fullAddress,
        tenure: tenure || null,
        purchaseType: purchaseType || null,
        purchasePrice: pricePence,
        vendorName: vendorName.trim() || undefined,
        vendorPhone: vendorPhone.trim() || undefined,
        vendorEmail: vendorEmail.trim() || undefined,
        purchaserName: purchaserName.trim() || undefined,
        purchaserPhone: purchaserPhone.trim() || undefined,
        purchaserEmail: purchaserEmail.trim() || undefined,
        progressedBy,
      });
      void result;
      toast.success("Draft saved", { description: fullAddress });
      clearForm();
      router.refresh();
    } catch {
      setError("Couldn't save draft. Try again.");
    } finally {
      setDraftSaving(false);
    }
  }

  async function submit() {
    if (!fullAddress || !tenure || !purchaseType) {
      setError("Please fill in the address, tenure and purchase type.");
      return;
    }
    if (progressedBy === "progressor") {
      if (!vendorName.trim() || (!vendorPhone.trim() && !vendorEmail.trim())) {
        setError("Vendor name and at least a phone or email are required when sending to Sales Progressor.");
        return;
      }
      if (!purchaserName.trim() || (!purchaserPhone.trim() && !purchaserEmail.trim())) {
        setError("Purchaser name and at least a phone or email are required when sending to Sales Progressor.");
        return;
      }
    }
    setLoading(true);
    setError("");

    const contacts = [
      ...(vendorName.trim() ? [{ name: titleCase(vendorName), phone: vendorPhone.trim() ? normalizePhone(vendorPhone) : null, email: vendorEmail.trim() || null, roleType: "vendor" as const }] : []),
      ...(purchaserName.trim() ? [{ name: titleCase(purchaserName), phone: purchaserPhone.trim() ? normalizePhone(purchaserPhone) : null, email: purchaserEmail.trim() || null, roleType: "purchaser" as const }] : []),
    ];

    try {
      if (draftId) {
        const result = await promoteDraftAction(draftId, {
          propertyAddress: fullAddress,
          tenure: tenure as Tenure,
          purchaseType: purchaseType as PurchaseType,
          purchasePrice: pricePence,
          contacts,
          progressedBy,
        });
        router.push(`/agent/transactions/${result.id}`);
      } else {
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyAddress: fullAddress,
            tenure,
            purchaseType,
            contacts,
            purchasePrice: pricePence,
            progressedBy,
            serviceType: progressedBy === "progressor" ? "outsourced" : "self_managed",
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

  return (
    <div className="space-y-4">
      {/* Two-column form grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>

        {/* Left: Property + Tenure/Type */}
        <div className="space-y-4">
          {/* Property address */}
          <div className={CARD}>
            <p className={LABEL}>Property address</p>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              onBlur={() => setStreet(titleCase(street))}
              placeholder="Street address"
              className={FIELD}
              autoFocus
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onBlur={() => setCity(titleCase(city))}
                placeholder="City / Town"
                className={FIELD}
              />
              <div>
                <input
                  type="text"
                  value={postcode}
                  onChange={(e) => {
                    setPostcode(e.target.value.toUpperCase());
                    if (postcodeError) setPostcodeError("");
                  }}
                  onBlur={handlePostcodeBlur}
                  placeholder="Postcode"
                  maxLength={8}
                  className={FIELD}
                />
                {postcodeError && (
                  <p className="text-xs text-red-500 mt-1">{postcodeError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tenure + Purchase type */}
          <div className={CARD}>
            <div>
              <p className={`${LABEL} mb-2`}>Tenure <span className="text-red-400">*</span></p>
              <div className="flex gap-2">
                <button type="button" className={`${TOGGLE_BASE} ${tenure === "freehold" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setTenure("freehold")}>Freehold</button>
                <button type="button" className={`${TOGGLE_BASE} ${tenure === "leasehold" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setTenure("leasehold")}>Leasehold</button>
              </div>
            </div>
            <div>
              <p className={`${LABEL} mb-2`}>Purchase type <span className="text-red-400">*</span></p>
              <div className="flex gap-2">
                <button type="button" className={`${TOGGLE_BASE} ${purchaseType === "mortgage" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setPurchaseType("mortgage")}>Mortgage</button>
                <button type="button" className={`${TOGGLE_BASE} ${purchaseType === "cash" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setPurchaseType("cash")}>Cash</button>
                <button type="button" className={`${TOGGLE_BASE} ${purchaseType === "cash_from_proceeds" ? TOGGLE_ON : TOGGLE_OFF}`} onClick={() => setPurchaseType("cash_from_proceeds")}>Proceeds</button>
              </div>
            </div>
            <div>
              <p className={`${LABEL} mb-2`}>Who progresses? <span className="text-red-400">*</span></p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProgressedBy("agent")}
                  className={`${TOGGLE_BASE}`}
                  style={{
                    flexDirection: "column", alignItems: "flex-start", justifyContent: "center",
                    padding: "10px 14px",
                    ...(progressedBy === "agent" ? { borderColor: "#34d399", background: "rgba(209,250,229,0.60)", color: "#065f46" } : {}),
                  }}
                >
                  <span className="block text-sm">Self-progress</span>
                  <span className="block text-[10px] font-normal opacity-60 mt-0.5">You manage this file</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProgressedBy("progressor")}
                  className={`${TOGGLE_BASE}`}
                  style={{
                    flexDirection: "column", alignItems: "flex-start", justifyContent: "center",
                    padding: "10px 14px",
                    ...(progressedBy === "progressor" ? { borderColor: "#60a5fa", background: "rgba(219,234,254,0.60)", color: "#1d4ed8" } : {}),
                  }}
                >
                  <span className="block text-sm">Send to us</span>
                  <span className="block text-[10px] font-normal opacity-60 mt-0.5">Sales Progressor handles it</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Contacts + Price + buttons */}
        <div className="space-y-4">
          {/* Vendor + Purchaser combined */}
          <div className={CARD}>
            <p className={LABEL}>
              Parties{progressedBy === "progressor" && <span className="text-red-400 ml-0.5">*</span>}
            </p>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-slate-900/35 uppercase tracking-wide">Vendor</p>
              <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" className={FIELD} />
              <input type="tel" value={vendorPhone} onChange={(e) => setVendorPhone(cleanPhone(e.target.value))} placeholder="Vendor phone" maxLength={20} className={FIELD} />
              <input type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} placeholder="Vendor email" maxLength={100} className={FIELD} />
            </div>
            <div className="pt-1 border-t border-white/20 space-y-1">
              <p className="text-[11px] font-semibold text-slate-900/35 uppercase tracking-wide">Purchaser</p>
              <input type="text" value={purchaserName} onChange={(e) => setPurchaserName(e.target.value)} placeholder="Purchaser name" className={FIELD} />
              <input type="tel" value={purchaserPhone} onChange={(e) => setPurchaserPhone(cleanPhone(e.target.value))} placeholder="Purchaser phone" maxLength={20} className={FIELD} />
              <input type="email" value={purchaserEmail} onChange={(e) => setPurchaserEmail(e.target.value)} placeholder="Purchaser email" maxLength={100} className={FIELD} />
            </div>
          </div>

          {/* Price */}
          <div className={CARD}>
            <p className={LABEL}>Purchase price (optional)</p>
            <PriceInput value={pricePence} onChange={setPricePence} placeholder="e.g. 350,000" />
          </div>

          {/* Error + actions */}
          {error && <p className="text-sm text-red-500 px-1">{error}</p>}

          {progressedBy === "progressor" && !outsourceContactsValid && (
            <p className="text-xs text-blue-600/70 px-1">Both vendor and purchaser need a name and at least a phone or email to send to us.</p>
          )}

          {hasAddress && (
            <button
              type="button"
              onClick={saveDraft}
              disabled={draftSaving}
              className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-slate-200/60 bg-white/40 text-slate-600 hover:bg-white/60 transition-all disabled:opacity-40"
            >
              {draftSaving ? "Saving…" : draftId ? "Update draft" : "Save draft"}
            </button>
          )}

          <button
            onClick={submit}
            disabled={loading || !hasAddress || !tenure || !purchaseType || !outsourceContactsValid}
            className="w-full py-4 rounded-2xl text-[15px] font-bold text-white transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37,99,235,0.40)" }}
          >
            {loading ? SUBMIT_MESSAGES[msgIndex] : "Create file"}
          </button>

          <p className="text-center text-xs text-slate-900/30">
            You can add more details after saving.
          </p>
        </div>
      </div>
    </div>
  );
}
