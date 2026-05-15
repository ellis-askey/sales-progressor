"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MemoStatusBar } from "@/components/transactions-v2/hero/MemoStatusBar";
import { HeroCard } from "@/components/transactions-v2/HeroCard";
import { ResearchPanel } from "@/components/transactions-v2/ResearchPanel";
import { PropertyDossier } from "@/components/transactions-v2/PropertyDossier";
import { FilePreview } from "@/components/transactions-v2/FilePreview";
import type { MilestoneDefinitionSlim } from "@/components/transactions-v2/FilePreview";
import { usePropertyIntel } from "@/lib/hooks/usePropertyIntel";
import { useSolidMode } from "@/lib/hooks/useSolidMode";
import { Stage1Fields } from "@/components/transactions-v2/form/Stage1Fields";
import { Stage1SummaryBar } from "@/components/transactions-v2/form/Stage1SummaryBar";
import { Stage2Sections } from "@/components/transactions-v2/form/Stage2Sections";
import { ChangeFileModal } from "@/components/transactions-v2/form/ChangeFileModal";
import { NavAwayModal } from "@/components/transactions-v2/NavAwayModal";
import { DuplicateAddressModal } from "@/components/transactions-v2/DuplicateAddressModal";
import { DraftPanel } from "@/components/transactions-v2/DraftPanel";
import { autoFillSolicitor } from "@/components/transactions-v2/form/SolicitorSection";
import { defaultFormFields } from "@/components/transactions-v2/form/types";
import type { InMemoryStub } from "@/components/transactions-v2/form/types";
import { NULL_MEMO_SOURCES } from "@/components/transactions-v2/types";
import type { ExtractedMemoData, FlowState, DraftEntry, MemoSources, ContactEntry } from "@/components/transactions-v2/types";
import type { FormFields } from "@/components/transactions-v2/form/types";
import { createTransactionAction, saveDraftAction, discardDraftAction } from "@/app/actions/transactions";
import { cleanPhone, formatPostcode } from "@/lib/utils/address";
import { titleCase } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastContext";

const SLOW_THRESHOLD_MS = 15_000;

// ── Memo source computation ────────────────────────────────────────────────────

function computeMemoSources(data: ExtractedMemoData, fields: FormFields): MemoSources {
  // Suppress "failed" hint once the user has filled the field themselves
  const fill = (extracted: boolean, hasValue: boolean) =>
    extracted ? "extracted" : hasValue ? null : "failed";
  return {
    streetAddress: fill(data.streetAddress != null, !!fields.streetAddress.trim()),
    city: fill(data.city != null, !!fields.city.trim()),
    postcode: fill(data.postcode != null, !!fields.postcode.trim()),
    purchasePricePence: fill(data.purchasePricePence != null, !!fields.purchasePricePence),
    tenure: fill(data.tenure != null, !!fields.tenure),
    purchaseType: "not_on_memos",
    vendors: fill(data.vendors.some((v) => v.name?.trim()), fields.vendors.some((v) => v.name.trim())),
    purchasers: fill(data.purchasers.some((p) => p.name?.trim()), fields.purchasers.some((p) => p.name.trim())),
    vendorSolicitor: fill(data.vendorSolicitor != null, !!fields.vendorSolicitor),
    purchaserSolicitor: fill(data.purchaserSolicitor != null, !!fields.purchaserSolicitor),
    agentFee: "not_on_memos",
  };
}

function populateFormFromExtraction(data: ExtractedMemoData): FormFields {
  const fields = defaultFormFields();

  if (data.streetAddress) fields.streetAddress = titleCase(data.streetAddress);
  if (data.city) fields.city = titleCase(data.city);
  if (data.postcode) fields.postcode = formatPostcode(data.postcode);
  if (data.purchasePricePence) fields.purchasePricePence = data.purchasePricePence;
  if (data.tenure) fields.tenure = data.tenure;

  if (data.vendors?.length) {
    const populated = data.vendors.filter((v) => v.name?.trim());
    if (populated.length) {
      fields.vendors = populated.map((v) => ({
        name: titleCase(v.name),
        phone: cleanPhone(v.phone ?? ""),
        email: v.email ?? "",
      }));
    }
  }

  if (data.purchasers?.length) {
    const populated = data.purchasers.filter((p) => p.name?.trim());
    if (populated.length) {
      fields.purchasers = populated.map((p) => ({
        name: titleCase(p.name),
        phone: cleanPhone(p.phone ?? ""),
        email: p.email ?? "",
      }));
    }
  }

  return fields;
}

function populateFormFromDraft(draft: DraftEntry): FormFields {
  const parts = draft.propertyAddress.split(", ");
  const streetAddress = parts[0] ?? "";
  const city = parts.length >= 3 ? parts.slice(1, -1).join(", ") : (parts[1] ?? "");
  const postcode = parts.length >= 3 ? (parts[parts.length - 1] ?? "") : "";

  const vendors: ContactEntry[] = draft.vendors.length > 0
    ? draft.vendors.map((v) => ({ name: v.name, phone: v.phone ?? "", email: v.email ?? "" }))
    : [{ name: "", phone: "", email: "" }];
  const purchasers: ContactEntry[] = draft.purchasers.length > 0
    ? draft.purchasers.map((p) => ({ name: p.name, phone: p.phone ?? "", email: p.email ?? "" }))
    : [{ name: "", phone: "", email: "" }];

  const vendorSolicitor = draft.vendorSolicitor ?? null;
  const purchaserSolicitor = draft.purchaserSolicitor ?? null;
  const vendorIsReferral = !!(draft.referredFirmId && vendorSolicitor?.firmId === draft.referredFirmId);
  const purchaserIsReferral = !!(draft.referredFirmId && purchaserSolicitor?.firmId === draft.referredFirmId);
  const agentFeeType: "amount" | "percent" = draft.agentFeePercent != null ? "percent" : "amount";

  return {
    streetAddress,
    city,
    postcode,
    purchasePricePence: draft.purchasePrice,
    tenure: (draft.tenure === "freehold" || draft.tenure === "leasehold") ? draft.tenure : "",
    purchaseType: (draft.purchaseType === "mortgage" || draft.purchaseType === "cash_buyer" || draft.purchaseType === "cash_from_proceeds") ? draft.purchaseType : "",
    progressedBy: draft.progressedBy === "progressor" ? "progressor" : "agent",
    vendors,
    purchasers,
    vendorSolicitor,
    purchaserSolicitor,
    vendorIsReferral,
    purchaserIsReferral,
    agentFeeType,
    agentFeeAmount: agentFeeType === "amount" ? draft.agentFeeAmount : null,
    agentFeePercentStr: draft.agentFeePercent != null ? String(draft.agentFeePercent) : "",
    agentFeeVat: draft.agentFeeIsVatInclusive ? "inclusive" : "exclusive",
    referralFee: draft.referralFee,
    broker: null,
    brokerReferralFee: null,
    purchaserBrokerReferral: false,
    notes: draft.notes ?? "",
    chainStubs: draft.chainStubs as InMemoryStub[],
    chainExpanded: draft.chainStubs.length > 0,
  };
}

function buildDraftInput(fields: FormFields, mosData: ExtractedMemoData | null, draftId?: string) {
  const propertyAddress = [fields.streetAddress, fields.city, fields.postcode].map((s) => s.trim()).filter(Boolean).join(", ") || "Draft";
  const referredFirmId = fields.vendorIsReferral
    ? (fields.vendorSolicitor?.firmId ?? null)
    : fields.purchaserIsReferral
    ? (fields.purchaserSolicitor?.firmId ?? null)
    : null;
  return {
    draftId,
    propertyAddress,
    tenure: fields.tenure || null,
    purchaseType: fields.purchaseType || null,
    purchasePrice: fields.purchasePricePence,
    notes: fields.notes.trim() || null,
    agentFeeAmount: fields.agentFeeType === "amount" ? fields.agentFeeAmount : null,
    agentFeePercent: fields.agentFeeType === "percent" ? (parseFloat(fields.agentFeePercentStr) || null) : null,
    agentFeeIsVatInclusive: fields.agentFeeVat === "inclusive",
    vendors: fields.vendors.filter((v) => v.name.trim()).map((v) => ({ name: v.name.trim(), phone: v.phone.trim() || null, email: v.email.trim() || null })),
    purchasers: fields.purchasers.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), phone: p.phone.trim() || null, email: p.email.trim() || null })),
    vendorSolicitorFirmId: fields.vendorSolicitor?.firmId ?? null,
    vendorSolicitorContactId: fields.vendorSolicitor?.contactId ?? null,
    purchaserSolicitorFirmId: fields.purchaserSolicitor?.firmId ?? null,
    purchaserSolicitorContactId: fields.purchaserSolicitor?.contactId ?? null,
    referredFirmId,
    referralFee: referredFirmId ? fields.referralFee : null,
    brokerFirmId: fields.broker?.firmId ?? null,
    brokerContactId: fields.broker?.contactId ?? null,
    brokerReferralFee: fields.broker ? fields.brokerReferralFee : null,
    mosStoragePath: mosData?.mosStoragePath ?? null,
    mosFileSize: mosData?.mosFileSize ?? null,
    mosMimeType: mosData?.mosMimeType ?? null,
    mosFilename: mosData?.mosFilename ?? null,
    progressedBy: fields.progressedBy,
    chainStubs: fields.chainStubs,
  };
}

// ── Submit button ─────────────────────────────────────────────────────────────

function SubmitButton({
  isSubmitting, isDisabled, buttonText, onClick,
}: {
  isSubmitting: boolean;
  isDisabled: boolean;
  buttonText: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className="agent-btn-color-primary"
      style={{
        width: "100%", padding: "14px", borderRadius: 14,
        fontWeight: 600, fontSize: 15, border: "none",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isSubmitting ? 0.75 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "opacity 150ms",
      }}
    >
      {isSubmitting && (
        <span className="agent-btn-spinner" style={{ width: 16, height: 16, borderTopColor: "rgba(255,255,255,0.9)", borderColor: "rgba(255,255,255,0.3)" }} />
      )}
      {isSubmitting ? "Creating..." : buttonText}
    </button>
  );
}

function OutsourcedHintCard({ text, isSolid }: { text: string; isSolid: boolean }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: isSolid ? "rgba(245,158,11,0.14)" : "rgba(245,158,11,0.07)",
      border: isSolid ? "1px solid rgba(245,158,11,0.40)" : "0.5px solid rgba(245,158,11,0.22)",
      borderRadius: 10,
      padding: "8px 12px",
      marginBottom: 8,
      fontSize: 11,
      fontWeight: 500,
      color: "#92400e",
    }}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="6.5" cy="6.5" r="5.75" stroke="currentColor" strokeWidth="1.1" />
        <path d="M6.5 4.5v3M6.5 9v.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {text}
    </div>
  );
}

function SaveDraftButton({ isSaving, onClick }: { isSaving: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      className={isSaving ? undefined : "agent-link"}
      style={{
        display: "block", width: "100%", marginTop: 10, padding: "8px",
        background: "none", border: "none", cursor: isSaving ? "default" : "pointer",
        fontSize: 12, fontWeight: 500,
        color: isSaving ? "rgba(15,23,42,0.30)" : undefined,
        textAlign: "center",
      }}
    >
      {isSaving ? "Saving draft…" : "Save draft"}
    </button>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type OutsourcedError = { field: "vendors" | "purchasers"; message: string } | null;

type Props = {
  recommendedFirms: { id: string; defaultReferralFeePence: number | null }[];
  preferredBroker: import("@/components/brokers/BrokerPicker").BrokerSelection | null;
  preferredBrokerDefaultFee: number | null;
  initialDrafts: DraftEntry[];
  allMilestoneDefinitions: MilestoneDefinitionSlim[];
};

// ── Component ─────────────────────────────────────────────────────────────────

export function NewSaleFlow({ recommendedFirms, preferredBroker, preferredBrokerDefaultFee, initialDrafts, allMilestoneDefinitions }: Props) {
  const { addToast } = useToast();
  const router = useRouter();

  // ── Flow state ────────────────────────────────────────────────────────────
  const [flowState, setFlowState] = useState<FlowState>("hero");
  const [stage, setStage] = useState<1 | 2>(1);
  const [isSlow, setIsSlow] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedMemoData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [formFields, setFormFields] = useState<FormFields>(() => defaultFormFields());
  const [manuallyEditedFields, setManuallyEditedFields] = useState<Set<string>>(new Set());

  // ── Solicitor autofill tracking ───────────────────────────────────────────
  const [solFillingVendor, setSolFillingVendor] = useState(false);
  const [solFillingPurchaser, setSolFillingPurchaser] = useState(false);
  const [solHintVendor, setSolHintVendor] = useState<string | null>(null);
  const [solHintPurchaser, setSolHintPurchaser] = useState<string | null>(null);

  // ── Validation state ──────────────────────────────────────────────────────
  const [outsourcedError, setOutsourcedError] = useState<OutsourcedError>(null);

  // Clear outsourcedError as soon as the failing condition is resolved
  useEffect(() => {
    if (!outsourcedError) return;
    if (outsourcedError.field === "vendors") {
      const ok = formFields.vendors.some((v) => v.name.trim() && (v.phone.trim() || v.email.trim()));
      if (ok) setOutsourcedError(null);
    } else if (outsourcedError.field === "purchasers") {
      const ok = formFields.purchasers.some((p) => p.name.trim() && (p.phone.trim() || p.email.trim()));
      if (ok) setOutsourcedError(null);
    }
  }, [formFields.vendors, formFields.purchasers, outsourcedError]);

  // ── Submit state ──────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ id: string; assignedTo: string | null } | null>(null);

  // ── Draft state ───────────────────────────────────────────────────────────
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftEntry[]>(initialDrafts);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showChangeFileModal, setShowChangeFileModal] = useState(false);
  const [showNavModal, setShowNavModal] = useState(false);
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);

  // ── Property intel (right column) ─────────────────────────────────────────
  const intel = usePropertyIntel();
  const [fromMemo, setFromMemo] = useState(false);

  // ── Stage 1 summary bar expand/collapse ───────────────────────────────────
  const [stage1Expanded, setStage1Expanded] = useState(false);

  // ── Right column mode ─────────────────────────────────────────────────────
  const [rightColumnMode, setRightColumnMode] = useState<"research" | "preview">("research");
  const [hoveredTab, setHoveredTab] = useState<"research" | "preview" | null>(null);
  const isSolid = useSolidMode();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const abortRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snapshot of form fields at extraction time — used for precise dirty tracking
  const extractedSnapshotRef = useRef<FormFields | null>(null);
  // Auto-scroll target when Stage 2 reveals in manual mode
  const stage2ContainerRef = useRef<HTMLDivElement>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const memoSources: MemoSources = extractedData
    ? computeMemoSources(extractedData, formFields)
    : NULL_MEMO_SOURCES;

  const stage1Valid =
    formFields.streetAddress.trim().length >= 3 &&
    formFields.tenure !== "" &&
    formFields.purchaseType !== "";

  const isOutsourced = formFields.progressedBy === "progressor";

  // Form is considered dirty if the user has moved past the hero screen
  const formIsDirty = flowState !== "hero" && flowState !== "extracting";

  // ── Precise dirty tracking via snapshot comparison ────────────────────────
  // Recomputes manuallyEditedFields whenever formFields change in extracted state.
  // "Type then untype" correctly removes the field from the dirty set.
  useEffect(() => {
    const snapshot = extractedSnapshotRef.current;
    if (!snapshot || flowState !== "extracted") return;
    const edited = new Set<string>();
    for (const key of Object.keys(snapshot) as (keyof FormFields)[]) {
      if (JSON.stringify(formFields[key]) !== JSON.stringify(snapshot[key])) {
        edited.add(key);
      }
    }
    setManuallyEditedFields(edited);
  }, [formFields, flowState]);

  // ── Auto-scroll when Stage 2 reveals in manual mode ──────────────────────
  useEffect(() => {
    if (stage !== 2 || flowState !== "manual") return;
    const timer = setTimeout(() => {
      stage2ContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 330);
    return () => clearTimeout(timer);
  }, [stage, flowState]);

  // ── Navigation guard — warn before tab close when form has unsaved data ──
  useEffect(() => {
    if (!formIsDirty || currentDraftId !== null) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [formIsDirty, currentDraftId]);

  // ── In-app nav guard — intercept sidebar link clicks when form has unsaved data ──
  useEffect(() => {
    if (!formIsDirty || currentDraftId !== null) return;
    function clickHandler(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.pathname === window.location.pathname) return;
      } catch { return; }
      e.preventDefault();
      e.stopPropagation();
      setPendingNavHref(href);
      setShowNavModal(true);
    }
    document.addEventListener("click", clickHandler, true);
    return () => document.removeEventListener("click", clickHandler, true);
  }, [formIsDirty, currentDraftId]);

  // ── Nav-away modal handlers ───────────────────────────────────────────────

  function handleNavStay() {
    setShowNavModal(false);
    setPendingNavHref(null);
  }

  function handleNavDiscard() {
    setShowNavModal(false);
    if (pendingNavHref) router.push(pendingNavHref);
  }

  async function handleNavSaveDraft() {
    await saveDraft();
    setShowNavModal(false);
    if (pendingNavHref) router.push(pendingNavHref);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function clearTimers() {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
  }

  function resetToHero() {
    abortRef.current?.abort();
    clearTimers();
    setFlowState("hero");
    setStage(1);
    setIsSlow(false);
    setExtractedData(null);
    setExtractionError(null);
    setFormFields(defaultFormFields());
    setManuallyEditedFields(new Set());
    setSolFillingVendor(false);
    setSolFillingPurchaser(false);
    setSolHintVendor(null);
    setSolHintPurchaser(null);
    setOutsourcedError(null);
    setIsSubmitting(false);
    setDuplicateInfo(null);
    setCurrentDraftId(null);
    setIsSavingDraft(false);
    setShowChangeFileModal(false);
    extractedSnapshotRef.current = null;
    intel.clear();
    setFromMemo(false);
    setStage1Expanded(false);
    setRightColumnMode("research");
  }

  function updateFormFields(updates: Partial<FormFields>) {
    setFormFields((prev) => ({ ...prev, ...updates }));
  }

  // no-op — dirty tracking is handled by the useEffect above
  function markFieldEdited(_field: string) {}

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    abortRef.current?.abort();
    clearTimers();

    const controller = new AbortController();
    abortRef.current = controller;

    setFlowState("extracting");
    setStage(1);
    setIsSlow(false);
    setExtractionError(null);
    setExtractedData(null);
    setFormFields(defaultFormFields());
    setManuallyEditedFields(new Set());
    setSolFillingVendor(false);
    setSolFillingPurchaser(false);
    setSolHintVendor(null);
    setSolHintPurchaser(null);
    setOutsourcedError(null);
    extractedSnapshotRef.current = null;

    slowTimerRef.current = setTimeout(() => setIsSlow(true), SLOW_THRESHOLD_MS);

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/agent/memo-parse", {
        method: "POST",
        body,
        signal: controller.signal,
      });

      clearTimers();

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Upload failed (${res.status})`);
      }

      const data: ExtractedMemoData = await res.json();
      setExtractedData(data);

      const newFields = populateFormFromExtraction(data);
      extractedSnapshotRef.current = { ...newFields }; // snapshot before any user edits
      setFormFields(newFields);
      setManuallyEditedFields(new Set());

      setSolHintVendor(data.vendorSolicitor?.firm ?? null);
      setSolHintPurchaser(data.purchaserSolicitor?.firm ?? null);

      setFlowState("extracted");
      setRightColumnMode("preview");
      setStage1Expanded(false);

      // Trigger property intel lookup from extracted address
      if (newFields.postcode.trim().length >= 5) {
        setFromMemo(true);
        intel.lookupImmediate({
          postcode: newFields.postcode,
          street: newFields.streetAddress || null,
          city: newFields.city || null,
        });
      }

      // Auto-save draft on MOS upload so the navigation guard doesn't fire
      const mosDraftInput = buildDraftInput(newFields, data, undefined);
      saveDraftAction(mosDraftInput).then((result) => {
        setCurrentDraftId(result.id);
        upsertDraftInList(result.id, mosDraftInput.propertyAddress, {
          tenure: newFields.tenure || null,
          purchaseType: newFields.purchaseType || null,
          purchasePrice: newFields.purchasePricePence,
          vendors: newFields.vendors.filter((v) => v.name.trim()).map((v) => ({ name: v.name.trim(), phone: v.phone.trim() || null, email: v.email.trim() || null })),
          purchasers: newFields.purchasers.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), phone: p.phone.trim() || null, email: p.email.trim() || null })),
          progressedBy: newFields.progressedBy,
          // vendorSolicitor / purchaserSolicitor are null here — autofill runs after this
        });
      }).catch(() => {});

      // Solicitor autofill — non-blocking, runs after state update
      if (data.vendorSolicitor?.firm) {
        setSolFillingVendor(true);
        autoFillSolicitor(
          titleCase(data.vendorSolicitor.firm),
          {
            name: data.vendorSolicitor.name ? titleCase(data.vendorSolicitor.name) : null,
            phone: data.vendorSolicitor.phone ?? null,
            email: data.vendorSolicitor.email?.toLowerCase() ?? null,
          },
          (v) => setFormFields((prev) => prev.vendorSolicitor !== null ? prev : { ...prev, vendorSolicitor: v }),
        ).then((result) => {
          setSolFillingVendor(false);
          if (result !== false) setSolHintVendor(null);
        });
      }

      if (data.purchaserSolicitor?.firm) {
        setSolFillingPurchaser(true);
        autoFillSolicitor(
          titleCase(data.purchaserSolicitor.firm),
          {
            name: data.purchaserSolicitor.name ? titleCase(data.purchaserSolicitor.name) : null,
            phone: data.purchaserSolicitor.phone ?? null,
            email: data.purchaserSolicitor.email?.toLowerCase() ?? null,
          },
          (v) => setFormFields((prev) => prev.purchaserSolicitor !== null ? prev : { ...prev, purchaserSolicitor: v }),
        ).then((result) => {
          setSolFillingPurchaser(false);
          if (result !== false) setSolHintPurchaser(null);
        });
      }

    } catch (err) {
      clearTimers();
      if ((err as { name?: string }).name === "AbortError") return;
      setExtractionError((err as Error).message || "Couldn't read the memo");
      setFlowState("manual");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCancel() {
    resetToHero();
  }

  function handleChangeFile() {
    if (manuallyEditedFields.size > 0) {
      setShowChangeFileModal(true);
    } else {
      resetToHero();
    }
  }

  function handleFillManually() {
    setFlowState("manual");
    setStage(1);
    setExtractedData(null);
    setExtractionError(null);
    setFormFields(defaultFormFields());
    setManuallyEditedFields(new Set());
    setOutsourcedError(null);
    extractedSnapshotRef.current = null;
    intel.clear();
    setFromMemo(false);
    setStage1Expanded(false);
    setRightColumnMode("research");
  }

  function handleContinue() {
    setStage(2);
    setStage1Expanded(false);
    setRightColumnMode("preview");
  }

  // ── Draft helpers ─────────────────────────────────────────────────────────

  function upsertDraftInList(id: string, address: string, extra: Partial<DraftEntry> = {}) {
    setDrafts((prev) => {
      if (prev.some((d) => d.id === id)) {
        return prev.map((d) => (d.id === id ? { ...d, propertyAddress: address } : d));
      }
      return [{
        id, propertyAddress: address,
        tenure: extra.tenure ?? null,
        purchaseType: extra.purchaseType ?? null,
        purchasePrice: extra.purchasePrice ?? null,
        createdAt: new Date().toISOString(),
        notes: extra.notes ?? null,
        agentFeeAmount: extra.agentFeeAmount ?? null,
        agentFeePercent: extra.agentFeePercent ?? null,
        agentFeeIsVatInclusive: extra.agentFeeIsVatInclusive ?? null,
        vendors: extra.vendors ?? [],
        purchasers: extra.purchasers ?? [],
        vendorSolicitor: extra.vendorSolicitor ?? null,
        purchaserSolicitor: extra.purchaserSolicitor ?? null,
        referredFirmId: extra.referredFirmId ?? null,
        referralFee: extra.referralFee ?? null,
        mosStoragePath: extra.mosStoragePath ?? null,
        mosFileSize: extra.mosFileSize ?? null,
        mosMimeType: extra.mosMimeType ?? null,
        mosFilename: extra.mosFilename ?? null,
        progressedBy: extra.progressedBy ?? "agent",
        chainStubs: extra.chainStubs ?? [],
      }, ...prev];
    });
  }

  async function saveDraft() {
    setIsSavingDraft(true);
    try {
      const input = buildDraftInput(formFields, extractedData, currentDraftId ?? undefined);
      const result = await saveDraftAction(input);
      setCurrentDraftId(result.id);
      upsertDraftInList(result.id, input.propertyAddress, {
        tenure: formFields.tenure || null,
        purchaseType: formFields.purchaseType || null,
        purchasePrice: formFields.purchasePricePence,
        notes: formFields.notes.trim() || null,
        agentFeeAmount: formFields.agentFeeType === "amount" ? formFields.agentFeeAmount : null,
        agentFeePercent: formFields.agentFeeType === "percent" ? (parseFloat(formFields.agentFeePercentStr) || null) : null,
        agentFeeIsVatInclusive: formFields.agentFeeVat === "inclusive",
        vendors: formFields.vendors.filter((v) => v.name.trim()).map((v) => ({ name: v.name.trim(), phone: v.phone.trim() || null, email: v.email.trim() || null })),
        purchasers: formFields.purchasers.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), phone: p.phone.trim() || null, email: p.email.trim() || null })),
        vendorSolicitor: formFields.vendorSolicitor,
        purchaserSolicitor: formFields.purchaserSolicitor,
        referredFirmId: input.referredFirmId ?? null,
        referralFee: formFields.referralFee,
        progressedBy: formFields.progressedBy,
        chainStubs: formFields.chainStubs as DraftEntry["chainStubs"],
      });
      addToast("Draft saved", "success");
    } catch {
      addToast("Couldn't save draft. Try again.", "error");
    } finally {
      setIsSavingDraft(false);
    }
  }

  function loadDraft(draft: DraftEntry) {
    const fields = populateFormFromDraft(draft);
    setFormFields(fields);
    setFlowState("manual");
    setStage(1);
    setCurrentDraftId(draft.id);
    setManuallyEditedFields(new Set());
    setOutsourcedError(null);
    extractedSnapshotRef.current = null;
    // Auto-advance to Stage 2 if Stage 1 fields are already complete
    if (fields.streetAddress.trim().length >= 3 && fields.tenure !== "" && fields.purchaseType !== "") {
      setStage(2);
    }
  }

  async function deleteDraft(draftId: string) {
    try {
      await discardDraftAction(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      if (currentDraftId === draftId) setCurrentDraftId(null);
    } catch {
      addToast("Couldn't remove draft.", "error");
    }
  }

  async function handleSubmit(forceCreate = false) {
    setOutsourcedError(null);

    if (!formFields.tenure || !formFields.purchaseType) {
      setStage1Expanded(true);
      addToast(
        !formFields.tenure && !formFields.purchaseType
          ? "Select tenure and purchase type to continue"
          : !formFields.tenure
          ? "Select tenure to continue"
          : "Select purchase type to continue",
        "error",
      );
      return;
    }

    if (isOutsourced) {
      const hasValidVendor = formFields.vendors.some(
        (v) => v.name.trim() && (v.phone.trim() || v.email.trim()),
      );
      if (!hasValidVendor) {
        setOutsourcedError({ field: "vendors", message: "Add at least one vendor with a name and a contact method (phone or email)" });
        return;
      }
      const hasValidPurchaser = formFields.purchasers.some(
        (p) => p.name.trim() && (p.phone.trim() || p.email.trim()),
      );
      if (!hasValidPurchaser) {
        setOutsourcedError({ field: "purchasers", message: "Add at least one purchaser with a name and a contact method (phone or email)" });
        return;
      }
    }

    setIsSubmitting(true);
    if (!forceCreate) setDuplicateInfo(null);

    const propertyAddress = [formFields.streetAddress, formFields.city, formFields.postcode]
      .map((s) => s.trim()).filter(Boolean).join(", ");

    const contacts = [
      ...formFields.vendors
        .filter((v) => v.name.trim())
        .map((v) => ({ name: v.name.trim(), phone: v.phone.trim() || undefined, email: v.email.trim() || undefined, roleType: "vendor" as const })),
      ...formFields.purchasers
        .filter((p) => p.name.trim())
        .map((p) => ({ name: p.name.trim(), phone: p.phone.trim() || undefined, email: p.email.trim() || undefined, roleType: "purchaser" as const })),
    ];

    const referredFirmId = formFields.vendorIsReferral
      ? (formFields.vendorSolicitor?.firmId ?? null)
      : formFields.purchaserIsReferral
      ? (formFields.purchaserSolicitor?.firmId ?? null)
      : null;

    try {
      const result = await createTransactionAction({
        propertyAddress,
        purchasePrice: formFields.purchasePricePence,
        tenure: (formFields.tenure as "freehold" | "leasehold") || null,
        purchaseType: (formFields.purchaseType as "mortgage" | "cash_buyer" | "cash_from_proceeds") || null,
        notes: formFields.notes.trim() || null,
        progressedBy: formFields.progressedBy,
        contacts,
        vendorSolicitorFirmId: formFields.vendorSolicitor?.firmId ?? null,
        vendorSolicitorContactId: formFields.vendorSolicitor?.contactId ?? null,
        purchaserSolicitorFirmId: formFields.purchaserSolicitor?.firmId ?? null,
        purchaserSolicitorContactId: formFields.purchaserSolicitor?.contactId ?? null,
        agentFeeAmount: formFields.agentFeeType === "amount" ? formFields.agentFeeAmount : null,
        agentFeePercent: formFields.agentFeeType === "percent" ? (parseFloat(formFields.agentFeePercentStr) || null) : null,
        agentFeeIsVatInclusive: formFields.agentFeeVat === "inclusive",
        referredFirmId,
        referralFee: referredFirmId ? formFields.referralFee : null,
        brokerFirmId: formFields.broker?.firmId ?? null,
        brokerContactId: formFields.broker?.contactId ?? null,
        brokerReferralFee: formFields.broker ? formFields.brokerReferralFee : null,
        purchaserBrokerReferral: formFields.purchaseType === "mortgage" ? formFields.purchaserBrokerReferral : false,
        mosUploaded: flowState === "extracted",
        mosStoragePath: extractedData?.mosStoragePath,
        mosFileSize: extractedData?.mosFileSize,
        mosMimeType: extractedData?.mosMimeType,
        mosFilename: extractedData?.mosFilename,
        forceCreate,
        chain: formFields.chainStubs.length > 0
          ? { stubs: formFields.chainStubs, sendInvites: true }
          : undefined,
      });

      const qs = result.mosAutoConfirmed ? "?mosConfirmed=1" : "?newFile=1";
      router.push(`/agent/transactions/${result.id}${qs}`);
    } catch (err) {
      setIsSubmitting(false);
      const error = err as Error & { duplicateId?: string; assignedTo?: string | null };
      if (error.message === "DUPLICATE_ADDRESS") {
        setDuplicateInfo({ id: error.duplicateId ?? "", assignedTo: error.assignedTo ?? null });
      } else {
        addToast("The file didn't save. Try again or contact support.", "error");
      }
    }
  }

  function handleForceCreate() {
    setDuplicateInfo(null);
    handleSubmit(true);
  }

  // ── Outsourced submit readiness (live, re-computed every render) ──────────

  const vendorHasName = formFields.vendors.some((v) => v.name.trim());
  const hasValidVendor = formFields.vendors.some((v) => v.name.trim() && (v.phone.trim() || v.email.trim()));
  const purchaserHasName = formFields.purchasers.some((p) => p.name.trim());
  const hasValidPurchaser = formFields.purchasers.some((p) => p.name.trim() && (p.phone.trim() || p.email.trim()));
  const tenurePurchaseReady = !!formFields.tenure && !!formFields.purchaseType;
  const outsourcedReady = !isOutsourced || (hasValidVendor && hasValidPurchaser);

  const submitButtonText = (() => {
    if (!formFields.tenure && !formFields.purchaseType) return "Select tenure and purchase type";
    if (!formFields.tenure) return "Select tenure to continue";
    if (!formFields.purchaseType) return "Select purchase type to continue";
    if (!isOutsourced || outsourcedReady) return "Create file";
    if (!vendorHasName) return "Add 1 vendor to continue";
    if (!hasValidVendor) return "Add a contact method to continue";
    if (!purchaserHasName) return "Add 1 purchaser to continue";
    return "Add a contact method to continue";
  })();

  const isSubmitDisabled = isSubmitting || !tenurePurchaseReady || !outsourcedReady;

  // ── Render ────────────────────────────────────────────────────────────────

  function handleFormLookup() {
    setFromMemo(false);
    intel.lookupImmediate({
      postcode: formFields.postcode,
      street: formFields.streetAddress || null,
      city: formFields.city || null,
    });
  }

  const stage1FieldProps = {
    streetAddress: formFields.streetAddress,
    city: formFields.city,
    postcode: formFields.postcode,
    tenure: formFields.tenure,
    purchaseType: formFields.purchaseType,
    progressedBy: formFields.progressedBy,
    onStreetAddressChange: (v: string) => updateFormFields({ streetAddress: v }),
    onCityChange: (v: string) => updateFormFields({ city: v }),
    onPostcodeChange: (v: string) => updateFormFields({ postcode: v }),
    onTenureChange: (v: "freehold" | "leasehold") => updateFormFields({ tenure: v }),
    onPurchaseTypeChange: (v: "mortgage" | "cash_buyer" | "cash_from_proceeds") => updateFormFields({ purchaseType: v }),
    onProgressedByChange: (v: "agent" | "progressor") => updateFormFields({ progressedBy: v }),
    onEdit: markFieldEdited,
    onLookup: handleFormLookup,
  } as const;

  const stage2SectionsProps = {
    fields: formFields,
    onChange: updateFormFields,
    onEdit: markFieldEdited,
    isFillingVendorSolicitor: solFillingVendor,
    isFillingPurchaserSolicitor: solFillingPurchaser,
    vendorSolicitorHint: solHintVendor,
    purchaserSolicitorHint: solHintPurchaser,
    recommendedFirms,
    preferredBroker,
    preferredBrokerDefaultFee,
  } as const;

  return (
    <div>

      {/* ── Two-column layout — all states ─────────────────────────────────── */}
      <div className="new-sale-two-col">

        <div className="new-sale-form-col">

          {/* State 1: Conversational hero card */}
          {flowState === "hero" && (
            <HeroCard
              drafts={drafts}
              onFile={handleFile}
              onFillManually={handleFillManually}
              onLoadDraft={loadDraft}
              onDeleteDraft={deleteDraft}
            />
          )}

          {/* MOS status bar — extracting + extracted */}
          {(flowState === "extracting" || flowState === "extracted") && (
            <MemoStatusBar
              status={flowState === "extracting" ? "reading" : "done"}
              isSlow={isSlow}
              extractedData={extractedData}
              formTenure={formFields.tenure}
              formPurchaseType={formFields.purchaseType}
              formStreetAddress={formFields.streetAddress}
              formCity={formFields.city}
              formPostcode={formFields.postcode}
              onCancel={handleCancel}
              onChangeFile={handleChangeFile}
              onFocusField={(key) => {
                if (["tenure", "purchaseType", "streetAddress", "city", "postcode", "purchasePrice"].includes(key)) {
                  setStage1Expanded(true);
                }
              }}
            />
          )}

          {/* State 2: Extracted — Stage 1 summary bar + optional Stage 1 fields + Stage 2 */}
          {flowState === "extracted" && (
            <>
              {/* Stage 1 fields expand above summary bar when Edit clicked */}
              {stage1Expanded && (
                <div style={{ animation: "agent-section-in 360ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) 0ms both", marginTop: 16 }}>
                  <Stage1Fields
                    {...stage1FieldProps}
                    memoSources={{
                      streetAddress: memoSources.streetAddress,
                      city: memoSources.city,
                      postcode: memoSources.postcode,
                      tenure: memoSources.tenure,
                      purchaseType: memoSources.purchaseType,
                    }}
                    showContinueButton={false}
                  />
                  <button
                    type="button"
                    onClick={() => setStage1Expanded(false)}
                    className="agent-btn agent-btn-secondary agent-btn-sm"
                    style={{ display: "block", width: "100%", marginTop: 8, marginBottom: 2 }}
                  >
                    ↑ Done editing
                  </button>
                </div>
              )}

              {/* Stage 1 summary bar — hidden while editing */}
              {!stage1Expanded && <div style={{ animation: "agent-section-in 360ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) 0ms both", marginTop: 8 }}>
                <Stage1SummaryBar
                  streetAddress={formFields.streetAddress}
                  city={formFields.city}
                  postcode={formFields.postcode}
                  tenure={formFields.tenure}
                  purchaseType={formFields.purchaseType}
                  progressedBy={formFields.progressedBy}
                  onEdit={() => setStage1Expanded(true)}
                  onProgressedByChange={(v) => { updateFormFields({ progressedBy: v }); markFieldEdited("progressedBy"); }}
                />
              </div>}

              <Stage2Sections
                {...stage2SectionsProps}
                memoSources={memoSources}
                startDelay={1}
                isOutsourced={isOutsourced}
                vendorError={outsourcedError?.field === "vendors" ? outsourcedError.message : null}
                purchaserError={outsourcedError?.field === "purchasers" ? outsourcedError.message : null}
              />
              <div style={{ marginTop: 20 }}>
                {isOutsourced && !outsourcedReady && !isSubmitting && (
                  <OutsourcedHintCard text={submitButtonText} isSolid={isSolid} />
                )}
                <SubmitButton
                  isSubmitting={isSubmitting}
                  isDisabled={isSubmitDisabled}
                  buttonText={submitButtonText}
                  onClick={() => handleSubmit()}
                />
                <SaveDraftButton isSaving={isSavingDraft} onClick={saveDraft} />
              </div>
            </>
          )}

          {/* State 3: Manual entry — Stage 1 fields with Continue gate; Stage 2 shows summary bar */}
          {flowState === "manual" && (
            <div>

              {/* Stage 1 — full fields + Continue gate */}
              {stage === 1 && (
                <div style={{ animation: "agent-section-in 360ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) 0ms both" }}>
                  <Stage1Fields
                    {...stage1FieldProps}
                    memoSources={{
                      streetAddress: NULL_MEMO_SOURCES.streetAddress,
                      city: NULL_MEMO_SOURCES.city,
                      postcode: NULL_MEMO_SOURCES.postcode,
                      tenure: NULL_MEMO_SOURCES.tenure,
                      purchaseType: NULL_MEMO_SOURCES.purchaseType,
                    }}
                    showContinueButton={stage1Valid}
                    onContinue={handleContinue}
                  />
                </div>
              )}

              {/* Stage 2 — summary bar (above), optional expanded Stage 1 fields, then Stage 2 sections */}
              {stage === 2 && (
                <>
                  {/* Stage 1 fields expand above summary bar when Edit clicked */}
                  {stage1Expanded && (
                    <div style={{ animation: "agent-section-in 360ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) 0ms both" }}>
                      <Stage1Fields
                        {...stage1FieldProps}
                        memoSources={{
                          streetAddress: NULL_MEMO_SOURCES.streetAddress,
                          city: NULL_MEMO_SOURCES.city,
                          postcode: NULL_MEMO_SOURCES.postcode,
                          tenure: NULL_MEMO_SOURCES.tenure,
                          purchaseType: NULL_MEMO_SOURCES.purchaseType,
                        }}
                        showContinueButton={false}
                      />
                      <button
                        type="button"
                        onClick={() => setStage1Expanded(false)}
                        style={{
                          display: "block", width: "100%", marginTop: 6, marginBottom: 2,
                          padding: "6px", background: "none", border: "none", cursor: "pointer",
                          fontSize: 11, fontWeight: 600, color: "rgba(15,23,42,0.38)", textAlign: "center",
                        }}
                      >
                        ↑ Done editing
                      </button>
                    </div>
                  )}

                  {/* Summary bar — hidden while editing */}
                  {!stage1Expanded && <div style={{ animation: "agent-section-in 360ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) 0ms both" }}>
                    <Stage1SummaryBar
                      streetAddress={formFields.streetAddress}
                      city={formFields.city}
                      postcode={formFields.postcode}
                      tenure={formFields.tenure}
                      purchaseType={formFields.purchaseType}
                      progressedBy={formFields.progressedBy}
                      onEdit={() => setStage1Expanded(true)}
                      onProgressedByChange={(v) => { updateFormFields({ progressedBy: v }); markFieldEdited("progressedBy"); }}
                    />
                  </div>}

                  <div ref={stage2ContainerRef}>
                    <Stage2Sections
                      {...stage2SectionsProps}
                      memoSources={NULL_MEMO_SOURCES}
                      startDelay={0}
                      isOutsourced={isOutsourced}
                      vendorError={outsourcedError?.field === "vendors" ? outsourcedError.message : null}
                      purchaserError={outsourcedError?.field === "purchasers" ? outsourcedError.message : null}
                    />
                  </div>

                  <div style={{ marginTop: 20 }}>
                    {isOutsourced && !outsourcedReady && !isSubmitting && (
                      <OutsourcedHintCard text={submitButtonText} isSolid={isSolid} />
                    )}
                    <SubmitButton
                      isSubmitting={isSubmitting}
                      isDisabled={isSubmitDisabled}
                      buttonText={submitButtonText}
                      onClick={() => handleSubmit()}
                    />
                    <SaveDraftButton isSaving={isSavingDraft} onClick={saveDraft} />
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* Right column — file preview or property intel */}
        <div className="new-sale-right-col">
          {/* Tab strip — only shown when both modes are relevant */}
          {(flowState === "extracted" || (flowState === "manual" && stage === 2)) && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {(["research", "preview"] as const).map((mode) => {
                const active = rightColumnMode === mode;
                const tabHovered = hoveredTab === mode && !active;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRightColumnMode(mode)}
                    onMouseEnter={() => setHoveredTab(mode)}
                    onMouseLeave={() => setHoveredTab(null)}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      border: active
                        ? "1.5px solid var(--agent-coral-deep)"
                        : tabHovered
                        ? "1.5px solid var(--agent-coral)"
                        : isSolid ? "1.5px solid rgba(15,23,42,0.12)" : "1.5px solid var(--agent-border-default)",
                      background: active
                        ? "rgba(var(--agent-coral-base-rgb), 0.07)"
                        : tabHovered
                        ? "var(--agent-coral-bg-tint)"
                        : isSolid ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.40)",
                      color: active
                        ? "var(--agent-coral-deep)"
                        : "var(--agent-text-primary)",
                      cursor: "pointer",
                      transition: "border-color 150ms, background 150ms, color 150ms",
                    }}
                  >
                    {mode === "research" ? "Property Research" : "File Preview"}
                  </button>
                );
              })}
            </div>
          )}

          <div key={rightColumnMode} style={{ animation: "right-col-fadein 220ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) 0ms both" }}>
            {rightColumnMode === "preview" ? (
              <FilePreview fields={formFields} allMilestoneDefinitions={allMilestoneDefinitions} />
            ) : intel.state === "success" && intel.data ? (
              <PropertyDossier
                data={intel.data}
                formTenure={formFields.tenure}
                onUseTenure={(v) => updateFormFields({ tenure: v })}
                onClear={() => { intel.clear(); setFromMemo(false); }}
                fromMemo={fromMemo}
              />
            ) : (
              <ResearchPanel
                onSearch={(postcode) => { setFromMemo(false); intel.lookup({ postcode }); }}
                onSearchImmediate={(postcode) => { setFromMemo(false); intel.lookupImmediate({ postcode }); }}
                state={intel.state}
                onRetry={intel.retry}
              />
            )}
          </div>
        </div>

      </div>

      {/* Change file confirmation modal */}
      {showChangeFileModal && (
        <ChangeFileModal
          onConfirm={resetToHero}
          onCancel={() => setShowChangeFileModal(false)}
        />
      )}

      {/* Nav-away modal — fires when user clicks a sidebar link with unsaved data */}
      {showNavModal && (
        <NavAwayModal
          isSaving={isSavingDraft}
          onDiscard={handleNavDiscard}
          onStay={handleNavStay}
          onSave={handleNavSaveDraft}
        />
      )}

      {/* Draft panel — hidden in hero state; HeroCard handles drafts inline there */}
      {flowState !== "hero" && (
        <DraftPanel
          drafts={drafts}
          currentDraftId={currentDraftId}
          onLoad={loadDraft}
          onDelete={deleteDraft}
        />
      )}

      {/* Duplicate address modal */}
      {duplicateInfo && (
        <DuplicateAddressModal
          address={[formFields.streetAddress, formFields.city, formFields.postcode].map((s) => s.trim()).filter(Boolean).join(", ")}
          duplicateId={duplicateInfo.id}
          assignedTo={duplicateInfo.assignedTo}
          onClose={() => setDuplicateInfo(null)}
          onForceCreate={handleForceCreate}
        />
      )}

    </div>
  );
}
