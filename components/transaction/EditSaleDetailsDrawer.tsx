"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { PriceInput } from "@/components/ui/PriceInput";
import { formatPrice, formatFee } from "@/lib/services/fees";
import {
  savePriceAction,
  saveAgentFeeAction,
  saveReferralAction,
  saveOverrideDateAction,
  saveCompletionDateAction,
  getSaleDetailsDelta,
  confirmSaleDetailsAction,
  getAddressConsequencesAction,
  saveAddressAction,
  saveIsShareOfFreeholdAction,
} from "@/app/actions/transactions";
import type { SaleDetailsDelta, SaleDetailsDeltaItem } from "@/app/actions/transactions";
import type { Tenure, PurchaseType } from "@prisma/client";

// ── Constants ─────────────────────────────────────────────────────────────────

const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
  mortgage: "Mortgage",
  cash_buyer: "Cash buyer",
  cash_from_proceeds: "Cash from proceeds",
};
const TENURE_LABELS: Record<Tenure, string> = {
  leasehold: "Leasehold",
  freehold: "Freehold",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAddress(addr: string) {
  const parts = addr.split(", ");
  const re = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s[0-9][A-Z]{2}$/;
  const remaining = [...parts];
  let postcode = "";
  let city = "";
  if (remaining.length > 0 && re.test(remaining[remaining.length - 1])) postcode = remaining.pop()!;
  if (remaining.length > 1) city = remaining.pop()!;
  return { street: remaining.join(", "), city, postcode };
}

function fmt(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtShort(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionButtons({ hasChanges, saving, onSave, onCancel, label, error }: {
  hasChanges: boolean; saving: boolean; onSave: () => void; onCancel: () => void; label: string; error?: string | null;
}) {
  if (!hasChanges && !saving) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={!hasChanges || saving}
          className="flex-1 py-2 rounded-xl agent-btn-color-primary text-xs font-semibold transition-colors disabled:opacity-40">
          {saving ? "Saving…" : label}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="flex-1 py-2 text-xs rounded-xl agent-btn-ghost-bordered disabled:opacity-40">
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

function DeltaList({ label, items, color }: { label: string; items: SaleDetailsDeltaItem[]; color: "red" | "green" }) {
  const [expanded, setExpanded] = useState(items.length <= 5);
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, 5);
  const c = color === "red"
    ? { border: "border-red-100 divide-red-50", side: "bg-red-50 text-red-700 border-red-100" }
    : { border: "border-green-100 divide-green-50", side: "bg-green-50 text-green-700 border-green-100" };
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className={`rounded-lg border divide-y overflow-hidden ${c.border}`}>
        {shown.map((item) => (
          <div key={item.id} className="px-3 py-2 flex items-center gap-2">
            <span className="flex-1 text-sm text-slate-700 leading-snug">{item.name}</span>
            {item.wasComplete && (
              <span className="text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5 flex-shrink-0">
                was complete
              </span>
            )}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${c.side}`}>
              {item.side === "vendor" ? "Seller" : "Buyer"}
            </span>
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <button onClick={() => setExpanded((v) => !v)} className="text-xs agent-link-primary mt-1">
          {expanded ? "Show fewer" : `Show ${items.length - 5} more`}
        </button>
      )}
    </div>
  );
}

function UnsavedChangesModal({ sections, onSaveAll, onDiscard, onKeepEditing }: {
  sections: string[];
  onSaveAll: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onClick={onKeepEditing} />
      <div style={{ position: "relative", zIndex: 1, background: "var(--agent-surface-elevated)", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 16, maxWidth: 360, width: "100%", padding: "24px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: "0 0 8px" }}>Unsaved changes</h3>
        <p style={{ fontSize: 13, color: "rgba(15,23,42,0.55)", marginBottom: 12, lineHeight: 1.5 }}>
          {sections.length === 1 ? "This section has unsaved changes:" : "These sections have unsaved changes:"}
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 6 }}>
          {sections.map((s) => (
            <li key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(15,23,42,0.70)" }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
              {s}
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={onSaveAll} className="w-full py-2.5 rounded-xl agent-btn-color-primary text-sm font-semibold transition-colors">
            Save all
          </button>
          <button
            onClick={onDiscard}
            style={{ width: "100%", padding: "10px 0", borderRadius: 12, background: "rgba(239,68,68,0.06)", color: "rgb(220,38,38)", fontWeight: 500, fontSize: 14, border: "1px solid rgba(239,68,68,0.15)", cursor: "pointer", transition: "background 150ms" }}>
            Discard changes
          </button>
          <button onClick={onKeepEditing}
            className="w-full py-2.5 rounded-xl text-sm text-slate-900/60 glass-subtle transition-colors"
            style={{ border: "0.5px solid rgba(255,255,255,0.50)" }}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PropSaveStage =
  | "idle"
  | "loading_addr"
  | "addr_modal"
  | "addr_saving"
  | "tenure_checking"
  | "tenure_preview"
  | "tenure_saving";

type Props = {
  transactionId: string;
  propertyAddress: string;
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  isShareOfFreehold: boolean;
  purchasePrice: number | null;
  agentFeeAmount: number | null;
  agentFeePercent: number | null;
  agentFeeIsVatInclusive: boolean | null;
  referralFee: number | null;
  referredFirmName: string | null;
  referredFirmId: string | null;
  recommendedFirms?: { id: string; name: string; defaultReferralFeePence: number | null }[] | null;
  overridePredictedDate: Date | null;
  predictedExchangeDate: Date | null;
  completionDate: Date | null;
  exchangeConfirmed: boolean;
  hideCommercialFields?: boolean;
  onClose: () => void;
};

// ── Main component ────────────────────────────────────────────────────────────

export function EditSaleDetailsDrawer({
  transactionId,
  propertyAddress,
  tenure,
  purchaseType,
  isShareOfFreehold,
  purchasePrice,
  agentFeeAmount,
  agentFeePercent,
  agentFeeIsVatInclusive,
  referralFee,
  referredFirmId,
  recommendedFirms,
  overridePredictedDate,
  predictedExchangeDate,
  completionDate,
  exchangeConfirmed,
  hideCommercialFields = false,
  onClose,
}: Props) {
  const { theme } = usePortalTheme();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // ── Section 1: Property ──────────────────────────────────────────────────

  const [savedAddress, setSavedAddress] = useState(propertyAddress);
  const initParsed = parseAddress(propertyAddress);
  const [streetAddress, setStreetAddress] = useState(initParsed.street);
  const [city, setCity] = useState(initParsed.city);
  const [postcode, setPostcode] = useState(initParsed.postcode);

  const tenurePurchaseEditable = tenure !== null && purchaseType !== null;
  const [savedTenure, setSavedTenure] = useState<Tenure | null>(tenure);
  const [savedPurchaseType, setSavedPurchaseType] = useState<PurchaseType | null>(purchaseType);
  const [tenureInput, setTenureInput] = useState<Tenure>(tenure ?? "freehold");
  const [purchaseTypeInput, setPurchaseTypeInput] = useState<PurchaseType>(purchaseType ?? "mortgage");
  const [savedIsShareOfFreehold, setSavedIsShareOfFreehold] = useState(isShareOfFreehold);
  const [isShareOfFreeholdInput, setIsShareOfFreeholdInput] = useState(isShareOfFreehold);

  const [propStage, setPropStage] = useState<PropSaveStage>("idle");
  const [addrConsequences, setAddrConsequences] = useState<{ commCount: number; milestoneCount: number } | null>(null);
  const [propDelta, setPropDelta] = useState<SaleDetailsDelta | null>(null);
  const [propError, setPropError] = useState<string | null>(null);

  const joinedAddr = [streetAddress.trim(), city.trim(), postcode.trim()].filter(Boolean).join(", ");
  const addrChanged = joinedAddr !== savedAddress;
  const tenureChanged = tenurePurchaseEditable && tenureInput !== savedTenure;
  const purchaseTypeChanged = tenurePurchaseEditable && purchaseTypeInput !== savedPurchaseType;
  const isShareOfFreeholdChanged = tenurePurchaseEditable && tenureInput === "leasehold" && isShareOfFreeholdInput !== savedIsShareOfFreehold;
  const propHasChanges = addrChanged || tenureChanged || purchaseTypeChanged || isShareOfFreeholdChanged;

  // ── Section 2: Price & Fees ──────────────────────────────────────────────

  const [savedPrice, setSavedPrice] = useState<number | null>(purchasePrice);
  const [savedFeeAmount, setSavedFeeAmount] = useState<number | null>(agentFeeAmount);
  const [savedFeePercent, setSavedFeePercent] = useState<number | null>(agentFeePercent);
  const [savedFeeVat, setSavedFeeVat] = useState<boolean | null>(agentFeeIsVatInclusive);
  const [savedRefFirmId, setSavedRefFirmId] = useState<string>(referredFirmId ?? "");
  const [savedRefFee, setSavedRefFee] = useState<number | null>(referralFee);

  const [priceInput, setPriceInput] = useState<number | null>(purchasePrice);
  const [feeType, setFeeType] = useState<"amount" | "percent">(agentFeePercent ? "percent" : "amount");
  const [feeAmountInput, setFeeAmountInput] = useState<number | null>(agentFeeAmount);
  const [feePercentInput, setFeePercentInput] = useState(agentFeePercent ? String(Number(agentFeePercent).toFixed(2)) : "");
  const [feeVatInput, setFeeVatInput] = useState<"inclusive" | "exclusive">(agentFeeIsVatInclusive ? "inclusive" : "exclusive");
  const [refFirmInput, setRefFirmInput] = useState(referredFirmId ?? "");
  const [refFeeInput, setRefFeeInput] = useState<number | null>(referralFee);

  const [priceFeeStage, setPriceFeeStage] = useState<"idle" | "saving">("idle");
  const [priceFeeError, setPriceFeeError] = useState<string | null>(null);

  const currentFeeAmount = feeType === "amount" ? feeAmountInput : null;
  const currentFeePercent = feeType === "percent" ? (parseFloat(feePercentInput || "0") || null) : null;
  const currentFeeVat = feeVatInput === "inclusive";
  const feeChanged = currentFeeAmount !== savedFeeAmount || currentFeePercent !== savedFeePercent || currentFeeVat !== (savedFeeVat ?? false);
  const refChanged = refFirmInput !== savedRefFirmId || refFeeInput !== savedRefFee;
  const priceFeeHasChanges = priceInput !== savedPrice || feeChanged || refChanged;

  // ── Section 3: Timeline ──────────────────────────────────────────────────

  const [savedOverride, setSavedOverride] = useState<Date | null>(overridePredictedDate);
  const [savedCompletion, setSavedCompletion] = useState<Date | null>(completionDate);
  const [showOverrideInput, setShowOverrideInput] = useState(!!overridePredictedDate);
  const [overrideInput, setOverrideInput] = useState(
    overridePredictedDate ? new Date(overridePredictedDate).toISOString().split("T")[0] : ""
  );
  const [completionInput, setCompletionInput] = useState(
    completionDate ? new Date(completionDate).toISOString().split("T")[0] : ""
  );
  const [timelineStage, setTimelineStage] = useState<"idle" | "saving">("idle");
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const savedOverrideStr = savedOverride ? new Date(savedOverride).toISOString().split("T")[0] : "";
  const currentOverrideStr = showOverrideInput ? overrideInput : "";
  const overrideChanged = currentOverrideStr !== savedOverrideStr;
  const savedCompletionStr = savedCompletion ? new Date(savedCompletion).toISOString().split("T")[0] : "";
  const completionChanged = exchangeConfirmed && completionInput !== savedCompletionStr;
  const timelineHasChanges = overrideChanged || completionChanged;

  // ── Address tag (header) ─────────────────────────────────────────────────

  // ── Unsaved-changes tracking ─────────────────────────────────────────────

  const anyDirty = propHasChanges || priceFeeHasChanges || timelineHasChanges;
  const dirtySections: string[] = [];
  if (propHasChanges) dirtySections.push("Property");
  if (priceFeeHasChanges) dirtySections.push(hideCommercialFields ? "Price" : "Price & fees");
  if (timelineHasChanges) dirtySections.push("Timeline");
  const dirtyCount = dirtySections.length;

  const [showClosePrompt, setShowClosePrompt] = useState(false);

  function closeNow() {
    if (!closing) {
      setClosing(true);
      closeTimer.current = setTimeout(onClose, 200);
    }
  }

  function handleClose() {
    if (anyDirty) {
      setShowClosePrompt(true);
    } else {
      closeNow();
    }
  }

  async function handleSaveAll() {
    setShowClosePrompt(false);
    if (priceFeeHasChanges) await handlePriceFeesSave();
    if (timelineHasChanges) await handleTimelineSave();
    if (propHasChanges) handlePropSave();
  }

  // ── Refs for IntersectionObserver ────────────────────────────────────────

  const bodyRef = useRef<HTMLDivElement>(null);
  const propSectionRef = useRef<HTMLDivElement>(null);
  const priceFeesSectionRef = useRef<HTMLDivElement>(null);
  const timelineSectionRef = useRef<HTMLDivElement>(null);

  const [propInView, setPropInView] = useState(true);
  const [priceFeesInView, setPriceFeesInView] = useState(true);
  const [timelineInView, setTimelineInView] = useState(true);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === propSectionRef.current) setPropInView(entry.isIntersecting);
          else if (entry.target === priceFeesSectionRef.current) setPriceFeesInView(entry.isIntersecting);
          else if (entry.target === timelineSectionRef.current) setTimelineInView(entry.isIntersecting);
        }
      },
      { root: body, threshold: 0 }
    );
    if (propSectionRef.current) observer.observe(propSectionRef.current);
    if (priceFeesSectionRef.current) observer.observe(priceFeesSectionRef.current);
    if (timelineSectionRef.current) observer.observe(timelineSectionRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Escape handler ───────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (propStage === "addr_modal") {
        setPropStage("idle");
      } else if (propStage === "tenure_preview") {
        setPropDelta(null);
        setPropStage("idle");
      } else if (showClosePrompt) {
        setShowClosePrompt(false);
      } else if (anyDirty) {
        setShowClosePrompt(true);
      } else {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [propStage, showClosePrompt, anyDirty, onClose]);

  // ── Section 1 handlers ───────────────────────────────────────────────────

  async function handlePropSave() {
    setPropError(null);
    if (addrChanged) {
      setPropStage("loading_addr");
      try {
        const consequences = await getAddressConsequencesAction(transactionId);
        setAddrConsequences(consequences);
        setPropStage("addr_modal");
      } catch (err) {
        setPropError(err instanceof Error ? err.message : "Couldn't load address info");
        setPropStage("idle");
      }
    } else {
      await handleTenureCheck();
    }
  }

  async function confirmAddressSave() {
    setPropStage("addr_saving");
    try {
      await saveAddressAction(transactionId, joinedAddr);
      setSavedAddress(joinedAddr);
      if (tenureChanged || purchaseTypeChanged || isShareOfFreeholdChanged) {
        await handleTenureCheck();
      } else {
        setPropStage("idle");
      }
    } catch (err) {
      setPropError(err instanceof Error ? err.message : "Couldn't save address");
      setPropStage("idle");
    }
  }

  async function handleTenureCheck() {
    if (!tenurePurchaseEditable || (!tenureChanged && !purchaseTypeChanged)) {
      // Only isShareOfFreehold changed — save it directly without the delta preview flow
      if (isShareOfFreeholdChanged) {
        setPropStage("tenure_saving");
        try {
          await saveIsShareOfFreeholdAction(transactionId, isShareOfFreeholdInput);
          setSavedIsShareOfFreehold(isShareOfFreeholdInput);
        } catch (err) {
          setPropError(err instanceof Error ? err.message : "Couldn't save property type");
        }
      }
      setPropStage("idle");
      return;
    }
    setPropStage("tenure_checking");
    try {
      const delta = await getSaleDetailsDelta({ transactionId, newPurchaseType: purchaseTypeInput, newTenure: tenureInput });
      if (delta.noChange) {
        setSavedTenure(tenureInput);
        setSavedPurchaseType(purchaseTypeInput);
        setPropStage("idle");
      } else {
        setPropDelta(delta);
        setPropStage("tenure_preview");
      }
    } catch (err) {
      setPropError(err instanceof Error ? err.message : "Couldn't load preview");
      setPropStage("idle");
    }
  }

  async function handleTenureConfirm() {
    setPropStage("tenure_saving");
    try {
      await confirmSaleDetailsAction({ transactionId, newPurchaseType: purchaseTypeInput, newTenure: tenureInput });
      setSavedTenure(tenureInput);
      setSavedPurchaseType(purchaseTypeInput);
      if (isShareOfFreeholdChanged) {
        await saveIsShareOfFreeholdAction(transactionId, isShareOfFreeholdInput);
        setSavedIsShareOfFreehold(isShareOfFreeholdInput);
      }
      setPropDelta(null);
      setPropStage("idle");
    } catch (err) {
      setPropError(err instanceof Error ? err.message : "Couldn't save sale details");
      setPropStage("idle");
    }
  }

  function handlePropCancel() {
    const orig = parseAddress(savedAddress);
    setStreetAddress(orig.street);
    setCity(orig.city);
    setPostcode(orig.postcode);
    setTenureInput(savedTenure ?? "freehold");
    setPurchaseTypeInput(savedPurchaseType ?? "mortgage");
    setIsShareOfFreeholdInput(savedIsShareOfFreehold);
    setPropDelta(null);
    setPropError(null);
    setPropStage("idle");
  }

  // ── Section 2 handlers ───────────────────────────────────────────────────

  async function handlePriceFeesSave() {
    setPriceFeeError(null);
    setPriceFeeStage("saving");
    try {
      if (priceInput !== savedPrice && priceInput !== null) {
        await savePriceAction(transactionId, priceInput);
        setSavedPrice(priceInput);
      }
      if (feeChanged) {
        await saveAgentFeeAction({ transactionId, agentFeeAmount: currentFeeAmount, agentFeePercent: currentFeePercent, agentFeeIsVatInclusive: currentFeeVat });
        setSavedFeeAmount(currentFeeAmount);
        setSavedFeePercent(currentFeePercent);
        setSavedFeeVat(currentFeeVat);
      }
      if (refChanged) {
        let feePence = refFeeInput;
        if (feePence == null && refFirmInput && recommendedFirms) {
          const firm = recommendedFirms.find((f) => f.id === refFirmInput);
          feePence = firm?.defaultReferralFeePence ?? null;
        }
        await saveReferralAction(transactionId, { referredFirmId: refFirmInput || null, referralFee: feePence, referralFeeReceived: false });
        setSavedRefFirmId(refFirmInput);
        setSavedRefFee(feePence);
      }
      setPriceFeeStage("idle");
    } catch (err) {
      setPriceFeeError(err instanceof Error ? err.message : "Couldn't save — tap Save again to retry");
      setPriceFeeStage("idle");
    }
  }

  function handlePriceFeeCancel() {
    setPriceInput(savedPrice);
    setFeeType(savedFeePercent ? "percent" : "amount");
    setFeeAmountInput(savedFeeAmount);
    setFeePercentInput(savedFeePercent ? String(Number(savedFeePercent).toFixed(2)) : "");
    setFeeVatInput(savedFeeVat ? "inclusive" : "exclusive");
    setRefFirmInput(savedRefFirmId);
    setRefFeeInput(savedRefFee);
    setPriceFeeError(null);
  }

  // ── Section 3 handlers ───────────────────────────────────────────────────

  async function handleTimelineSave() {
    setTimelineError(null);
    setTimelineStage("saving");
    try {
      if (overrideChanged) {
        await saveOverrideDateAction(transactionId, currentOverrideStr || null);
        setSavedOverride(currentOverrideStr ? new Date(currentOverrideStr) : null);
      }
      if (completionChanged) {
        await saveCompletionDateAction(transactionId, completionInput || null);
        setSavedCompletion(completionInput ? new Date(completionInput) : null);
      }
      setTimelineStage("idle");
    } catch (err) {
      setTimelineError(err instanceof Error ? err.message : "Couldn't save — tap Save again to retry");
      setTimelineStage("idle");
    }
  }

  function handleTimelineCancel() {
    setShowOverrideInput(!!savedOverride);
    setOverrideInput(savedOverrideStr);
    setCompletionInput(savedCompletionStr);
    setTimelineError(null);
  }

  // ── Pill picker style helper ─────────────────────────────────────────────

  function pill(active: boolean): React.CSSProperties {
    return {
      flex: 1,
      padding: "5px 10px",
      borderRadius: 8,
      border: active ? "1.5px solid var(--agent-coral-deep)" : "1px solid rgba(255,255,255,0.50)",
      background: active ? "rgba(var(--agent-coral-base-rgb), 0.12)" : "rgba(255,255,255,0.30)",
      color: active ? "var(--agent-coral-deep)" : "rgba(15,23,42,0.50)",
      fontSize: 12,
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      transition: "all 150ms",
    };
  }

  // ── Derived render flags ─────────────────────────────────────────────────

  const propSaving = propStage === "addr_saving" || propStage === "tenure_saving" ||
    propStage === "loading_addr" || propStage === "tenure_checking";
  const propSaveBtnLabel =
    propStage === "loading_addr" || propStage === "addr_saving" ? "Saving…" :
    propStage === "tenure_checking" ? "Checking…" :
    (tenureChanged || purchaseTypeChanged) ? "Preview & save" : "Save";

  const showReferralSection = (recommendedFirms && recommendedFirms.length > 0) || !!referredFirmId;

  const outOfViewChips = [
    { key: "prop", label: "Property", dirty: propHasChanges, inView: propInView, ref: propSectionRef },
    { key: "fees", label: "Price & fees", dirty: priceFeeHasChanges, inView: priceFeesInView, ref: priceFeesSectionRef },
    { key: "timeline", label: "Timeline", dirty: timelineHasChanges, inView: timelineInView, ref: timelineSectionRef },
  ].filter((c) => c.dirty && !c.inView);

  // ── Render ───────────────────────────────────────────────────────────────

  return createPortal(
    <div data-theme={theme} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
      {/* Backdrop */}
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={handleClose} />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Edit sale details"
        style={{
          position: "relative", zIndex: 1, height: "100%", width: 440, maxWidth: "100vw",
          background: "var(--agent-surface-elevated)",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          animation: closing
            ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards"
            : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Edit sale details
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {propertyAddress}
            </p>
          </div>
          <button onClick={handleClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-sm">
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Out-of-view dirty section chips — sticky at top of scroll area */}
          {outOfViewChips.length > 0 && (
            <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", flexDirection: "column", gap: 4, marginBottom: -4 }}>
              {outOfViewChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => chip.ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 9999, background: "rgba(251,191,36,0.18)", border: "1px solid rgba(251,191,36,0.45)", color: "rgb(161,98,7)", fontSize: 11, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                  {chip.label} · unsaved
                </button>
              ))}
            </div>
          )}

          {/* ── Section 1: Property ──────────────────────────── */}
          <div ref={propSectionRef}>
            <p className="agent-section-label" style={{ marginBottom: 8 }}>
              {propHasChanges && (
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", marginRight: 6, verticalAlign: "middle" }} />
              )}
              Property
            </p>
            <div className="v2-drawer-section" style={{ borderRadius: 12, background: "rgba(255,255,255,0.40)", border: "0.5px solid rgba(255,255,255,0.50)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Address */}
              <div>
                <p className="text-xs text-slate-900/40 mb-1.5">Address</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: propStage === "tenure_preview" ? 0.5 : 1, pointerEvents: propStage === "tenure_preview" ? "none" : "auto" }}>
                  <input
                    type="text" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="Street address" disabled={propSaving}
                    className="glass-input agent-focus text-sm px-3 py-2 rounded-lg w-full"
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text" value={city} onChange={(e) => setCity(e.target.value)}
                      placeholder="Town / city" disabled={propSaving}
                      className="glass-input agent-focus text-sm px-3 py-2 rounded-lg flex-1"
                    />
                    <input
                      type="text" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                      placeholder="Postcode" disabled={propSaving}
                      className="glass-input agent-focus text-sm px-3 py-2 rounded-lg w-28"
                    />
                  </div>
                </div>
              </div>

              {/* Tenure + Purchase type pills — only when both are set */}
              {tenurePurchaseEditable && (
                <>
                  <div style={{ opacity: propStage === "tenure_preview" ? 0.5 : 1, pointerEvents: propStage === "tenure_preview" || propSaving ? "none" : "auto" }}>
                    <p className="text-xs text-slate-900/40 mb-1.5">Tenure</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["freehold", "leasehold"] as Tenure[]).map((t) => (
                        <button key={t} onClick={() => setTenureInput(t)} style={pill(tenureInput === t)}>
                          {TENURE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ opacity: propStage === "tenure_preview" ? 0.5 : 1, pointerEvents: propStage === "tenure_preview" || propSaving ? "none" : "auto" }}>
                    <p className="text-xs text-slate-900/40 mb-1.5">Purchase type</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(["mortgage", "cash_buyer", "cash_from_proceeds"] as PurchaseType[]).map((pt) => (
                        <button key={pt} onClick={() => setPurchaseTypeInput(pt)} style={pill(purchaseTypeInput === pt)}>
                          {PURCHASE_TYPE_LABELS[pt]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Share of freehold toggle — leasehold files only */}
                  {tenureInput === "leasehold" && propStage !== "tenure_preview" && (
                    <label style={{
                      display: "flex", alignItems: "center", gap: 8, cursor: propSaving ? "default" : "pointer",
                      opacity: propSaving ? 0.5 : 1,
                    }}>
                      <input
                        type="checkbox"
                        checked={isShareOfFreeholdInput}
                        onChange={(e) => setIsShareOfFreeholdInput(e.target.checked)}
                        disabled={propSaving}
                        style={{ width: 14, height: 14, accentColor: "var(--agent-coral)", cursor: "pointer", flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 12, color: "var(--agent-text-primary)" }}>Share of freehold</span>
                    </label>
                  )}

                  {propStage === "tenure_preview" && (
                    <p className="text-xs text-slate-900/40 italic" style={{ marginTop: -4 }}>Tap Back to change</p>
                  )}
                </>
              )}

              {/* Fix 8 delta preview — only in tenure_preview */}
              {propStage === "tenure_preview" && propDelta && (
                <div className="agent-reveal-in" style={{ borderTop: "0.5px solid rgba(15,23,42,0.08)", paddingTop: 12 }}>
                  <DeltaList label="These steps will be skipped" items={propDelta.becomingNr} color="red" />
                  <DeltaList label="These steps will be re-activated" items={propDelta.becomingRequired} color="green" />
                  {(propDelta.becomingNr.length > 0 || propDelta.becomingRequired.length > 0) && (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-slate-400 mb-0.5">Current</p>
                        <p className="text-xl font-semibold text-slate-700">{propDelta.currentPercent}%</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{propDelta.currentRemaining} left</p>
                      </div>
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <div className="text-center">
                        <p className="text-xs text-slate-400 mb-0.5">After</p>
                        <p className={`text-xl font-semibold ${propDelta.projectedPercent > propDelta.currentPercent ? "text-emerald-600" : propDelta.projectedPercent < propDelta.currentPercent ? "text-orange-500" : "text-slate-700"}`}>
                          {propDelta.projectedPercent}%
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{propDelta.projectedRemaining} left</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Property section Save/Cancel */}
            {(propHasChanges || propStage !== "idle") && (
              <div className="agent-reveal-in" style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {propStage === "tenure_preview" ? (
                    <>
                      <button onClick={handleTenureConfirm}
                        className="flex-1 py-2 rounded-xl agent-btn-color-primary text-xs font-semibold transition-colors">
                        Confirm changes
                      </button>
                      <button onClick={() => { setPropDelta(null); setPropStage("idle"); }}
                        className="flex-1 py-2 rounded-xl text-xs text-slate-900/60 glass-subtle transition-colors"
                        style={{ border: "0.5px solid rgba(255,255,255,0.50)" }}>
                        Back
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handlePropSave} disabled={!propHasChanges || propSaving}
                        className="flex-1 py-2 rounded-xl agent-btn-color-primary text-xs font-semibold transition-colors disabled:opacity-40">
                        {propSaving ? (propStage === "tenure_checking" ? "Checking…" : "Saving…") : propSaveBtnLabel}
                      </button>
                      <button onClick={handlePropCancel} disabled={propSaving}
                        className="flex-1 py-2 rounded-xl text-xs text-slate-900/60 glass-subtle transition-colors disabled:opacity-40"
                        style={{ border: "0.5px solid rgba(255,255,255,0.50)" }}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
                {propError && <p className="text-xs text-red-500 mt-2">{propError}</p>}
              </div>
            )}
          </div>

          {/* ── Section 2: Price & Fees ──────────────────────── */}
          <div ref={priceFeesSectionRef}>
            <p className="agent-section-label" style={{ marginBottom: 8 }}>
              {priceFeeHasChanges && (
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", marginRight: 6, verticalAlign: "middle" }} />
              )}
              {hideCommercialFields ? "Price" : "Price & fees"}
            </p>
            <div className="v2-drawer-section" style={{ borderRadius: 12, background: "rgba(255,255,255,0.40)", border: "0.5px solid rgba(255,255,255,0.50)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Purchase price */}
              <div>
                <p className="text-xs text-slate-900/40 mb-1.5">Purchase price</p>
                <PriceInput value={priceInput} onChange={setPriceInput} size="sm" className="w-full agent-focus" disabled={priceFeeStage === "saving"} />
              </div>

              {/* Agent fee */}
              {!hideCommercialFields && (
              <div>
                <p className="text-xs text-slate-900/40 mb-1.5">Agent fee</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <button onClick={() => setFeeType("amount")} style={pill(feeType === "amount")} disabled={priceFeeStage === "saving"}>Fixed £</button>
                  <button onClick={() => setFeeType("percent")} style={pill(feeType === "percent")} disabled={priceFeeStage === "saving"}>Percentage %</button>
                </div>
                {feeType === "amount" ? (
                  <PriceInput value={feeAmountInput} onChange={setFeeAmountInput} size="sm" className="w-full agent-focus" placeholder="1,500" disabled={priceFeeStage === "saving"} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number" value={feePercentInput} onChange={(e) => setFeePercentInput(e.target.value)}
                      placeholder="e.g. 1.5" inputMode="decimal" disabled={priceFeeStage === "saving"}
                      className="glass-input agent-focus text-sm px-3 py-2 rounded-lg flex-1"
                    />
                    <span className="text-xs text-slate-900/50">%</span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button onClick={() => setFeeVatInput("exclusive")} style={pill(feeVatInput === "exclusive")} disabled={priceFeeStage === "saving"}>+ VAT</button>
                  <button onClick={() => setFeeVatInput("inclusive")} style={pill(feeVatInput === "inclusive")} disabled={priceFeeStage === "saving"}>Inc. VAT</button>
                </div>
              </div>
              )}

              {/* Referral fee */}
              {!hideCommercialFields && showReferralSection && recommendedFirms && recommendedFirms.length > 0 && (
                <div>
                  <p className="text-xs text-slate-900/40 mb-1.5">Referral fee</p>
                  <select
                    value={refFirmInput}
                    onChange={(e) => {
                      const firmId = e.target.value;
                      setRefFirmInput(firmId);
                      if (!firmId) {
                        setRefFeeInput(null);
                      } else if (recommendedFirms) {
                        const firm = recommendedFirms.find((f) => f.id === firmId);
                        if (firm?.defaultReferralFeePence != null) setRefFeeInput(firm.defaultReferralFeePence);
                      }
                    }}
                    disabled={priceFeeStage === "saving"}
                    className="glass-input agent-focus w-full text-sm px-3 py-2 rounded-lg mb-2"
                  >
                    <option value="">— no referral —</option>
                    {recommendedFirms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  {refFirmInput && (
                    <PriceInput value={refFeeInput} onChange={setRefFeeInput} size="sm" className="w-full agent-focus" disabled={priceFeeStage === "saving"} />
                  )}
                </div>
              )}
            </div>

            <SectionButtons
              hasChanges={priceFeeHasChanges}
              saving={priceFeeStage === "saving"}
              onSave={handlePriceFeesSave}
              onCancel={handlePriceFeeCancel}
              label="Save"
              error={priceFeeError}
            />
          </div>

          {/* ── Section 3: Timeline ──────────────────────────── */}
          <div ref={timelineSectionRef}>
            <p className="agent-section-label" style={{ marginBottom: 8 }}>
              {timelineHasChanges && (
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", marginRight: 6, verticalAlign: "middle" }} />
              )}
              Timeline
            </p>
            <div className="v2-drawer-section" style={{ borderRadius: 12, background: "rgba(255,255,255,0.40)", border: "0.5px solid rgba(255,255,255,0.50)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Expected exchange date */}
              <div>
                <p className="text-xs text-slate-900/40 mb-1">Expected exchange</p>
                {!showOverrideInput ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <p className="text-sm text-slate-900/70">
                      Predicted:{" "}
                      <span className="font-semibold">{predictedExchangeDate ? fmt(predictedExchangeDate) : "—"}</span>
                    </p>
                    <button onClick={() => setShowOverrideInput(true)} disabled={timelineStage === "saving"}
                      className="text-xs agent-link-primary flex-shrink-0">
                      Use a different date
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <input
                        type="date" value={overrideInput} onChange={(e) => setOverrideInput(e.target.value)}
                        disabled={timelineStage === "saving"}
                        className="glass-input agent-focus text-sm px-3 py-2 rounded-lg flex-1"
                      />
                      <button
                        onClick={() => { setShowOverrideInput(false); setOverrideInput(""); }}
                        disabled={timelineStage === "saving"}
                        className="text-xs text-slate-900/40 hover:text-red-500 transition-colors flex-shrink-0">
                        Clear
                      </button>
                    </div>
                    {predictedExchangeDate && (
                      <p className="text-[11px] text-slate-900/35">(predicted: {fmtShort(predictedExchangeDate)})</p>
                    )}
                  </div>
                )}
              </div>

              {/* Completion date */}
              <div>
                <p className="text-xs text-slate-900/40 mb-1">Completion</p>
                {!exchangeConfirmed ? (
                  <p className="text-sm text-slate-900/30 italic">Set once exchange is confirmed</p>
                ) : (
                  <input
                    type="date" value={completionInput} onChange={(e) => setCompletionInput(e.target.value)}
                    disabled={timelineStage === "saving"}
                    className="glass-input agent-focus text-sm px-3 py-2 rounded-lg w-full"
                  />
                )}
              </div>
            </div>

            <SectionButtons
              hasChanges={timelineHasChanges}
              saving={timelineStage === "saving"}
              onSave={handleTimelineSave}
              onCancel={handleTimelineCancel}
              label="Save"
              error={timelineError}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px 20px", borderTop: "0.5px solid rgba(15,23,42,0.08)", flexShrink: 0, background: "rgba(255,255,255,0.20)" }}>
          {anyDirty ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgb(161,98,7)", fontWeight: 500 }}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                {dirtyCount} unsaved section{dirtyCount !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleClose}
                style={{ padding: "8px 20px", borderRadius: 12, background: "rgba(255,255,255,0.30)", color: "rgba(15,23,42,0.60)", fontWeight: 500, fontSize: 14, border: "1px solid rgba(255,255,255,0.50)", cursor: "pointer", transition: "background 150ms" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.60)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.30)")}>
                Close
              </button>
            </div>
          ) : (
            <button
              onClick={handleClose}
              style={{ width: "100%", padding: "10px 0", borderRadius: 12, background: "rgba(255,255,255,0.30)", color: "rgba(15,23,42,0.60)", fontWeight: 500, fontSize: 14, border: "1px solid rgba(255,255,255,0.50)", cursor: "pointer", transition: "background 150ms" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.60)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.30)")}>
              Close
            </button>
          )}
        </div>
      </div>

      {/* Address consequence modal */}
      {propStage === "addr_modal" && addrConsequences && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onClick={() => setPropStage("idle")} />
          <div style={{ position: "relative", zIndex: 1, background: "var(--agent-surface-elevated)", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 16, maxWidth: 380, width: "100%", padding: "24px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>Change address?</h3>
              <button onClick={() => setPropStage("idle")} className="agent-icon-btn agent-icon-btn-sm">
                <X size={14} weight="bold" />
              </button>
            </div>
            {(() => {
              const { commCount, milestoneCount } = addrConsequences;
              const commStr = commCount > 0 ? `${commCount} comm${commCount !== 1 ? "s" : ""}` : null;
              const msStr = milestoneCount > 0 ? `${milestoneCount} completed step${milestoneCount !== 1 ? "s" : ""}` : null;
              const ps: React.CSSProperties = { fontSize: 13, color: "rgba(15,23,42,0.60)", marginBottom: 20, lineHeight: 1.6 };
              return commStr || msStr ? (
                <p style={ps}>
                  This file has{" "}
                  {commStr && <strong>{commStr}</strong>}
                  {commStr && msStr && " and "}
                  {msStr && <strong>{msStr}</strong>}
                  {" "}logged at the current address. They&apos;ll keep references to the old address for the audit trail.
                </p>
              ) : (
                <p style={ps}>
                  The address will update. Any historical records keep their references to the old address for the audit trail.
                </p>
              );
            })()}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmAddressSave}
                className="flex-1 py-2.5 rounded-xl agent-btn-color-primary text-sm font-semibold transition-colors">
                Change address
              </button>
              <button onClick={() => setPropStage("idle")}
                className="flex-1 py-2.5 rounded-xl text-sm text-slate-900/60 glass-subtle transition-colors"
                style={{ border: "0.5px solid rgba(255,255,255,0.50)" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved changes prompt */}
      {showClosePrompt && (
        <UnsavedChangesModal
          sections={dirtySections}
          onSaveAll={handleSaveAll}
          onDiscard={closeNow}
          onKeepEditing={() => setShowClosePrompt(false)}
        />
      )}
    </div>,
    document.body
  );
}
