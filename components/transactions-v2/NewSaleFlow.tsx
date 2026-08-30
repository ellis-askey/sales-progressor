"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MemoStatusBar } from "@/components/transactions-v2/hero/MemoStatusBar";
import { HeroCard } from "@/components/transactions-v2/HeroCard";
import { ResearchPanel } from "@/components/transactions-v2/ResearchPanel";
import { PropertyDossier } from "@/components/transactions-v2/PropertyDossier";
import { EarningsBuilder } from "@/components/transactions-v2/EarningsBuilder";
import type { MilestoneDefinitionSlim } from "@/components/transactions-v2/FilePreview";
import { usePropertyIntel } from "@/lib/hooks/usePropertyIntel";
import { useSolidMode } from "@/lib/hooks/useSolidMode";
import { DemoHeroCard } from "@/components/transactions-v2/DemoHeroCard";
import { SaleHeroEditable } from "@/components/transactions-v2/SaleHeroEditable";
import { Stage2Sections } from "@/components/transactions-v2/form/Stage2Sections";
import { NotesSection } from "@/components/transactions-v2/form/NotesSection";
import { CollapsibleSection } from "@/components/transactions-v2/form/CollapsibleSection";
import { ChangeFileModal } from "@/components/transactions-v2/form/ChangeFileModal";
import { AgentPicker } from "@/components/agent-picker/AgentPicker";
import { NavAwayModal } from "@/components/transactions-v2/NavAwayModal";
import { DuplicateAddressModal } from "@/components/transactions-v2/DuplicateAddressModal";
import { SubmissionOverlay } from "@/components/transactions-v2/SubmissionOverlay";
import { DraftPanel } from "@/components/transactions-v2/DraftPanel";
import { autoFillSolicitor } from "@/components/transactions-v2/form/SolicitorSection";
import { defaultFormFields } from "@/components/transactions-v2/form/types";
import type { InMemoryStub } from "@/components/transactions-v2/form/types";
import { NULL_MEMO_SOURCES } from "@/components/transactions-v2/types";
import type { ExtractedMemoData, FlowState, DraftEntry, MemoSources, ContactEntry } from "@/components/transactions-v2/types";
import type { FormFields } from "@/components/transactions-v2/form/types";
import { createTransactionAction, saveDraftAction, discardDraftAction } from "@/app/actions/transactions";
import { mapPairwiseConflicts, type ContactConflict } from "@/lib/contacts/dedupe";
import { cleanPhone, formatPostcode, isValidUKPostcode } from "@/lib/utils/address";
import { titleCase } from "@/lib/utils";
import { useAgentToast } from "@/components/agent/AgentToaster";

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

function populateFormFromExtraction(
  data: ExtractedMemoData,
  defaultProgressedBy: "agent" | "progressor" = "agent",
): FormFields {
  const fields = defaultFormFields(defaultProgressedBy);

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
    isShareOfFreehold: false,
    purchaseType: (draft.purchaseType === "mortgage" || draft.purchaseType === "cash_buyer" || draft.purchaseType === "cash_from_proceeds") ? draft.purchaseType : "",
    progressedBy: draft.progressedBy === "progressor" ? "progressor" : "agent",
    // The draft list doesn't carry the photo path; a re-loaded draft starts
    // without a hero photo (the row keeps it, but the client list doesn't).
    photoStoragePath: null,
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
    // Drafts don't carry an assigned owner — picker defaults to the
    // current director if rendered, otherwise the field stays empty
    // and the server falls back to the caller.
    assignToUserId: "",
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
      color: "var(--agent-warning)",
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
      style={{
        display: "block", width: "100%", marginTop: 10, padding: "8px",
        background: "none", border: "none", cursor: isSaving ? "default" : "pointer",
        fontSize: 12, fontWeight: 500,
        color: isSaving ? "rgba(15,23,42,0.30)" : undefined,
        textAlign: "center",
      }}
    >
      {/* Underline hugs the text, not the full-width button. */}
      <span className={isSaving ? undefined : "agent-link"}>{isSaving ? "Saving draft…" : "Save draft"}</span>
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
  // Server-resolved: only true on the agent's very first sale AND only if
  // they've never clicked "I won't be using the portal" before. Once either
  // condition flips, the prompt is permanently hidden.
  showPortalPrompt: boolean;
  // Per-agency default for the "progressed by" toggle. Legacy progressor-
  // managed agencies start on "progressor" (send to us); everyone else
  // starts on "agent" (self-progress). Computed server-side by
  // deriveDefaultProgressedBy in lib/agency/default-progressed-by.ts.
  defaultProgressedBy: "agent" | "progressor";
  // Director-only assignment picker. When the viewer is a director, the
  // page pre-fetches every director/negotiator in the agency and passes
  // them in; the form renders an "Assign to" dropdown so the director
  // can hand the file to another agent on creation. Negotiators get
  // null and never see the picker.
  isDirector: boolean;
  currentUserId: string;
  assignableAgents: import("@/lib/services/agency-team").AssignableAgent[];
  showDemoHero: boolean;
  // Fee config for the earnings builder — the agency's outsourced-fee tier and
  // whether they're still inside the 14-day free-outsourcing trial.
  feeTier: string;
  legacyOutsourcedFeePence: number | null;
  withinTrial: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function NewSaleFlow({ recommendedFirms, preferredBroker, preferredBrokerDefaultFee, initialDrafts, allMilestoneDefinitions, showPortalPrompt, defaultProgressedBy, isDirector, currentUserId, assignableAgents, showDemoHero, feeTier, legacyOutsourcedFeePence, withinTrial }: Props) {
  const { toast } = useAgentToast();
  const router = useRouter();

  // ── Flow state ────────────────────────────────────────────────────────────
  const [flowState, setFlowState] = useState<FlowState>("hero");
  const [stage, setStage] = useState<1 | 2>(1);
  const [isSlow, setIsSlow] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedMemoData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [formFields, setFormFields] = useState<FormFields>(() => defaultFormFields(defaultProgressedBy));
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
  const [rightColumnMode, setRightColumnMode] = useState<"earnings" | "research">("earnings");
  const [hoveredTab, setHoveredTab] = useState<"earnings" | "research" | null>(null);
  const isSolid = useSolidMode();

  // Right-column Notes: open by default on desktop, closed on smaller
  // breakpoints. Starts closed (SSR-safe) and opens on desktop after mount; the
  // key remounts CollapsibleSection so its default re-applies when the
  // breakpoint flips.
  const [notesOpenByDefault, setNotesOpenByDefault] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setNotesOpenByDefault(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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

  // Manual entry: once the core details are in (address + tenure + purchase
  // type), reveal the rest of the form automatically — it fades up. No button.
  useEffect(() => {
    if (flowState === "manual" && stage === 1 && stage1Valid) setStage(2);
  }, [flowState, stage, stage1Valid]);

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
    setFormFields(defaultFormFields(defaultProgressedBy));
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
    setRightColumnMode("earnings");
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
    setFormFields(defaultFormFields(defaultProgressedBy));
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

      const newFields = populateFormFromExtraction(data, defaultProgressedBy);
      extractedSnapshotRef.current = { ...newFields }; // snapshot before any user edits
      setFormFields(newFields);
      setManuallyEditedFields(new Set());

      setSolHintVendor(data.vendorSolicitor?.firm ?? null);
      setSolHintPurchaser(data.purchaserSolicitor?.firm ?? null);

      setFlowState("extracted");
      setRightColumnMode("earnings");
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
        if (result.id === null) return; // internal account, no agency: silent skip (manual save shows the message)
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
    setFormFields(defaultFormFields(defaultProgressedBy));
    setManuallyEditedFields(new Set());
    setOutsourcedError(null);
    extractedSnapshotRef.current = null;
    intel.clear();
    setFromMemo(false);
    setStage1Expanded(false);
    setRightColumnMode("earnings");
  }

  function handleContinue() {
    setStage(2);
    setStage1Expanded(false);
    setRightColumnMode("earnings");
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

  // Guarantee a draft exists (with an id) and return it — used by the editable
  // hero's photo picker, which needs a real transaction row to upload against
  // before the file is created. Reuses the same draft the "Save draft" button
  // makes, so there's never more than one.
  async function ensureDraft(): Promise<string | null> {
    if (currentDraftId) return currentDraftId;
    try {
      const input = buildDraftInput(formFields, extractedData, undefined);
      const result = await saveDraftAction(input);
      if (result.id) setCurrentDraftId(result.id);
      return result.id;
    } catch {
      return null;
    }
  }

  async function saveDraft() {
    setIsSavingDraft(true);
    try {
      const input = buildDraftInput(formFields, extractedData, currentDraftId ?? undefined);
      const result = await saveDraftAction(input);
      if (result.id === null) {
        // Internal-staff account with no agency: drafts can't be created
        // (sales always belong to a customer agency). Honest message
        // instead of the generic failure toast.
        toast.error("This account isn't linked to an agency, so drafts can't be saved here.");
        return;
      }
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
      toast.success("Draft saved");
    } catch {
      toast.error("Couldn't save draft. Try again.");
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
      toast.error("Couldn't remove draft. Try again.");
    }
  }

  async function handleSubmit(forceCreate = false) {
    setOutsourcedError(null);

    if (!formFields.tenure || !formFields.purchaseType) {
      setStage1Expanded(true);
      toast.error(
        !formFields.tenure && !formFields.purchaseType
          ? "Select tenure and purchase type to continue"
          : !formFields.tenure
          ? "Select tenure to continue"
          : "Select purchase type to continue",
      );
      return;
    }

    if (isOutsourced) {
      const hasValidVendor = formFields.vendors.some(
        (v) => v.name.trim() && (v.phone.trim() || v.email.trim()),
      );
      if (!hasValidVendor) {
        setOutsourcedError({ field: "vendors", message: "Add at least one seller with a name and a phone number or email" });
        return;
      }
      const hasValidPurchaser = formFields.purchasers.some(
        (p) => p.name.trim() && (p.phone.trim() || p.email.trim()),
      );
      if (!hasValidPurchaser) {
        setOutsourcedError({ field: "purchasers", message: "Add at least one buyer with a name and a phone number or email" });
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
        isShareOfFreehold: formFields.tenure === "leasehold" ? formFields.isShareOfFreehold : false,
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
        photoStoragePath: formFields.photoStoragePath,
        mosUploaded: flowState === "extracted",
        mosStoragePath: extractedData?.mosStoragePath,
        mosFileSize: extractedData?.mosFileSize,
        mosMimeType: extractedData?.mosMimeType,
        mosFilename: extractedData?.mosFilename,
        forceCreate,
        // Director-only — pass the picked owner; server ignores when
        // empty or when the caller isn't a director. Negotiators never
        // populate this field because the picker isn't rendered for them.
        assignToUserId: formFields.assignToUserId || undefined,
        chain: formFields.chainStubs.length > 0
          ? { stubs: formFields.chainStubs, sendInvites: true }
          : undefined,
      });

      const qs = result.mosAutoConfirmed ? "?mosConfirmed=1" : "?newFile=1";
      const chainParam = result.chainFailed ? "&chainSetupFailed=1" : "";
      router.push(`/agent/transactions/${result.id}${qs}${chainParam}`);
    } catch (err) {
      setIsSubmitting(false);
      const error = err as Error & {
        duplicateId?: string;
        assignedTo?: string | null;
        kind?: "phone" | "email";
        withName?: string;
      };
      if (error.message === "DUPLICATE_ADDRESS") {
        setDuplicateInfo({ id: error.duplicateId ?? "", assignedTo: error.assignedTo ?? null });
      } else if (error.message === "DUPLICATE_CONTACT_FIELD") {
        // Server caught a pairwise contact conflict the client-side live
        // check should have caught earlier — surface it as a toast so the
        // user knows why submit didn't progress, even if the inline pill
        // also re-renders.
        const field = error.kind === "phone" ? "phone number" : "email";
        toast.error(`Two contacts share the same ${field}${error.withName ? ` (${error.withName})` : ""}. Update one before submitting.`);
      } else {
        toast.error("The file didn't save. Try again or contact support.");
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
    if (!vendorHasName) return "Add a seller to continue";
    if (!hasValidVendor) return "Add a phone number or email for the seller";
    if (!purchaserHasName) return "Add a buyer to continue";
    return "Add a phone number or email for the buyer";
  })();

  // Per-card phone/email-uniqueness conflicts across the contacts on the
  // file. Computed pairwise across the union of vendors + purchasers so
  // a vendor sharing a phone with a purchaser is caught too. Keyed by
  // role + the local card index. Cost is trivial (≤4 + ≤4 entries).
  const { vendorConflicts, purchaserConflicts, hasContactConflict } = (() => {
    const labelled = [
      ...formFields.vendors.map((c, i) => ({
        ...c,
        name: c.name.trim() || `Vendor ${i + 1}`,
        _role: "vendor" as const,
        _index: i,
      })),
      ...formFields.purchasers.map((c, i) => ({
        ...c,
        name: c.name.trim() || `Purchaser ${i + 1}`,
        _role: "purchaser" as const,
        _index: i,
      })),
    ];
    const conflicts = mapPairwiseConflicts(labelled);
    const vConflicts: Record<number, ContactConflict> = {};
    const pConflicts: Record<number, ContactConflict> = {};
    for (const [k, v] of Object.entries(conflicts)) {
      const offender = labelled[Number(k)];
      if (offender._role === "vendor") vConflicts[offender._index] = v;
      else pConflicts[offender._index] = v;
    }
    return {
      vendorConflicts: vConflicts,
      purchaserConflicts: pConflicts,
      hasContactConflict: Object.keys(conflicts).length > 0,
    };
  })();

  const isSubmitDisabled = isSubmitting || !tenurePurchaseReady || !outsourcedReady || hasContactConflict;

  // ── Render ────────────────────────────────────────────────────────────────

  function handleFormLookup() {
    setFromMemo(false);
    intel.lookupImmediate({
      postcode: formFields.postcode,
      street: formFields.streetAddress || null,
      city: formFields.city || null,
    });
  }

  // Auto-look-up the sale's postcode as it's entered, so the "Sold prices" tab
  // is already populated when they switch to it. The memo path looks up in
  // handleFile (fromMemo), so this covers manual entry only.
  const lastLookedUpPostcode = useRef<string | null>(null);
  useEffect(() => {
    if (fromMemo) return;
    if (flowState !== "manual" && flowState !== "extracted") return;
    const pc = formFields.postcode.trim().toUpperCase();
    if (!pc || !isValidUKPostcode(pc) || lastLookedUpPostcode.current === pc) return;
    lastLookedUpPostcode.current = pc;
    intel.lookup({ postcode: pc, street: formFields.streetAddress || null, city: formFields.city || null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromMemo, formFields.postcode, formFields.streetAddress, formFields.city, flowState]);

  const stage1FieldProps = {
    streetAddress: formFields.streetAddress,
    city: formFields.city,
    postcode: formFields.postcode,
    tenure: formFields.tenure,
    isShareOfFreehold: formFields.isShareOfFreehold,
    purchaseType: formFields.purchaseType,
    progressedBy: formFields.progressedBy,
    onStreetAddressChange: (v: string) => updateFormFields({ streetAddress: v }),
    onCityChange: (v: string) => updateFormFields({ city: v }),
    onPostcodeChange: (v: string) => updateFormFields({ postcode: v }),
    onTenureChange: (v: "freehold" | "leasehold") => updateFormFields({ tenure: v }),
    onIsShareOfFreeholdChange: (v: boolean) => updateFormFields({ isShareOfFreehold: v }),
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
    showPortalPrompt,
    vendorConflicts,
    purchaserConflicts,
  } as const;

  return (
    <div className="nv2-night new-sale-flow">

      {/* Full-width top hero. In the hero state it's the demo card; once the
          agent starts (memo or manual) that fades away and the live editable
          file hero takes its place, filling in as they work. */}
      {flowState === "hero" && showDemoHero && (
        <div style={{ marginBottom: 16 }}><DemoHeroCard /></div>
      )}
      {flowState !== "hero" && flowState !== "extracting" && (
        <div style={{ marginBottom: 16 }}>
          <SaleHeroEditable
            fields={formFields}
            onUpdate={updateFormFields}
            currentDraftId={currentDraftId}
            ensureDraft={ensureDraft}
            showMemoFooter={flowState === "extracted"}
            onChangeFile={handleChangeFile}
          />
        </div>
      )}

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

          {/* MOS status bar — only while reading; once read, the "needs
              attention" info lives in the hero footer instead. */}
          {flowState === "extracting" && (
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

          {/* State 2: Extracted — the editable hero is at the top; here we just
              show the rest of the form. */}
          {flowState === "extracted" && (
            <>
              <Stage2Sections
                {...stage2SectionsProps}
                memoSources={memoSources}
                startDelay={1}
                isOutsourced={isOutsourced}
                vendorError={outsourcedError?.field === "vendors" ? outsourcedError.message : null}
                purchaserError={outsourcedError?.field === "purchasers" ? outsourcedError.message : null}
              />
              <div style={{ marginTop: 20 }}>
                {isDirector && !isOutsourced && assignableAgents.length > 1 && (
                  <div
                    className="glass-card"
                    style={{ padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <AgentPicker
                      value={formFields.assignToUserId || currentUserId}
                      onChange={(v) => updateFormFields({ assignToUserId: v })}
                      agents={assignableAgents}
                      currentUserId={currentUserId}
                      label="Assign this file to"
                    />
                  </div>
                )}
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

          {/* State 3: Manual entry — the editable hero (top) collects the core
              details and its "Continue" reveals the rest of the form here. */}
          {flowState === "manual" && (
            <div>
              {stage === 2 && (
                <>
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
          {/* Tab strip — only shown when both modes are relevant. marginTop
              matches the left column's Stage2Sections so both columns' headers
              (this + the "Add what you have" line) start level; marginBottom
              matches the left column's gap so the cards below line up. */}
          {(flowState === "extracted" || flowState === "manual") && (
            <div style={{ display: "flex", gap: 6, marginTop: 16, marginBottom: 12 }}>
              {(["earnings", "research"] as const).map((mode) => {
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
                        : isSolid ? "1.5px solid var(--nv2-border-solid)" : "1.5px solid var(--agent-border-default)",
                      background: active
                        ? "rgba(var(--agent-coral-base-rgb), 0.07)"
                        : tabHovered
                        ? "var(--agent-coral-bg-tint)"
                        : isSolid ? "var(--nv2-bg-hover)" : "var(--nv2-surface-glass)",
                      color: active
                        ? "var(--agent-coral-deep)"
                        : tabHovered
                        ? "var(--agent-coral)"
                        : "var(--nv2-text-secondary)",
                      cursor: "pointer",
                      transition: "border-color 150ms, background 150ms, color 150ms",
                    }}
                  >
                    {mode === "earnings" ? "File worth" : "Sold prices"}
                  </button>
                );
              })}
            </div>
          )}

          <div key={rightColumnMode} style={{ animation: "right-col-fadein 220ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) 0ms both" }}>
            {/* Before they start (hero / reading a memo) the right column is the
                Sold-prices research. Once started, the "File worth" tab shows the
                earnings builder; "Sold prices" stays a tab. */}
            {rightColumnMode === "earnings" && (flowState === "extracted" || flowState === "manual") ? (
              <EarningsBuilder
                fields={formFields}
                onUpdate={updateFormFields}
                feeTier={feeTier}
                legacyOutsourcedFeePence={legacyOutsourcedFeePence}
                withinTrial={withinTrial}
                allMilestoneDefinitions={allMilestoneDefinitions}
              />
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

          {/* Notes — lives under the File worth / Sold prices tabs. Open by
              default on desktop, collapsed on smaller breakpoints. */}
          {(flowState === "extracted" || flowState === "manual") && (
            <div style={{ marginTop: 12 }}>
              <CollapsibleSection
                key={notesOpenByDefault ? "notes-open" : "notes-shut"}
                title="Notes"
                defaultOpen={notesOpenByDefault}
              >
                <NotesSection
                  notes={formFields.notes}
                  onNotesChange={(v) => updateFormFields({ notes: v })}
                />
              </CollapsibleSection>
            </div>
          )}
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

      {/* Submission loading overlay — shows for all creation paths */}
      <SubmissionOverlay isVisible={isSubmitting} />

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

