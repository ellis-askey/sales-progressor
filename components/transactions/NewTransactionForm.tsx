"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Tenure, PurchaseType } from "@prisma/client";
import { SolicitorPicker, type SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import { titleCase, normalizePhone } from "@/lib/utils";
import { PriceInput } from "@/components/ui/PriceInput";
import { createTransactionAction, saveDraftAction, discardDraftAction } from "@/app/actions/transactions";

type ContactEntry = { name: string; phone: string; email: string };

function emptyContact(): ContactEntry {
  return { name: "", phone: "", email: "" };
}

function cleanPhone(raw: string): string {
  return raw.replace(/[^\d+\s\-()]/g, "").slice(0, 20);
}

function formatPostcode(raw: string): string {
  const clean = raw.toUpperCase().replace(/\s+/g, "");
  if (clean.length >= 5 && clean.length <= 7) {
    return clean.slice(0, -3) + " " + clean.slice(-3);
  }
  return raw.toUpperCase();
}

function isValidUKPostcode(pc: string): boolean {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s[0-9][A-Z]{2}$/.test(pc.trim());
}

// ── "Auto-filled" badge shown next to field labels ───────────────────────────

function MemoTag() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-600 leading-none">
      <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      auto-filled
    </span>
  );
}

// ── Memo upload banner ────────────────────────────────────────────────────────

type MemoStatus = "idle" | "reading" | "done" | "error";

type MemoResult = {
  filled: string[];
  missing: string[];
  vendorSolicitorFirm: string | null;
  purchaserSolicitorFirm: string | null;
};

function MemoUploadBanner({
  status,
  result,
  error,
  onFile,
  onDismiss,
}: {
  status: MemoStatus;
  result: MemoResult | null;
  error: string;
  onFile: (file: File) => void;
  onDismiss: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  if (status === "reading") {
    return (
      <div className="rounded-xl border-2 border-violet-200 bg-violet-50/60 px-4 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-violet-800">Reading memo of sale…</p>
          <p className="text-xs text-violet-600/70 mt-0.5">Extracting the transaction details for you</p>
        </div>
      </div>
    );
  }

  if (status === "done" && result) {
    return (
      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Memo read — form auto-filled</p>
            {result.filled.length > 0 && (
              <p className="text-xs text-emerald-700 mt-0.5">
                <strong>Filled:</strong> {result.filled.join(", ")}
              </p>
            )}
            {result.missing.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                <strong>Still needed:</strong> {result.missing.join(", ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="text-emerald-400 hover:text-emerald-600 transition-colors flex-shrink-0 mt-0.5"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-red-50/60 px-4 py-3.5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-400 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-700">Couldn't read memo</p>
          <p className="text-xs text-red-500 mt-0.5">{error}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // idle — dropzone button
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={`w-full rounded-xl border-2 border-dashed px-4 py-3.5 flex items-center gap-3 transition-all text-left ${
          dragging
            ? "border-violet-400 bg-violet-50"
            : "border-violet-200/80 bg-violet-50/40 hover:border-violet-300 hover:bg-violet-50/70"
        }`}
      >
        <div className="w-9 h-9 rounded-lg bg-violet-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-violet-700">Upload Memo of Sale</p>
          <p className="text-xs text-violet-500/80 mt-0.5">Drop a PDF or photo and we&apos;ll fill the form in for you</p>
        </div>
      </button>
    </div>
  );
}

// ── Creating overlay ──────────────────────────────────────────────────────────

function CreatingOverlay({ address }: { address: string }) {
  const steps = [
    "Creating your file",
    "Setting up milestones",
    "Building your timeline",
    "Almost ready",
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 720);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(15,23,42,0.72)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        animation: "overlayFadeIn 0.22s ease-out both",
      }}
    >
      <div
        className="rounded-3xl p-8 max-w-xs w-full mx-4 text-center"
        style={{
          background: "rgba(255,255,255,0.94)",
          border: "1px solid rgba(255,255,255,0.75)",
          boxShadow: "0 24px 72px rgba(0,0,0,0.32), 0 4px 16px rgba(0,0,0,0.12)",
          animation: "cardSlideUp 0.32s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            boxShadow: "0 8px 24px rgba(59,130,246,0.45)",
            animation: "iconBreathe 1.9s ease-in-out infinite",
          }}
        >
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>

        {address && (
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-900/35 mb-2 truncate px-2">
            {address}
          </p>
        )}

        <h2 className="text-base font-semibold text-slate-900/80 mb-6">
          {steps[step]}&hellip;
        </h2>

        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-blue-500"
              style={{ animation: `dotBounce 1.1s ease-in-out ${i * 0.18}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Draft support ─────────────────────────────────────────────────────────────

type DraftEntry = {
  id: string;
  propertyAddress: string;
  tenure: string | null;
  purchaseType: string | null;
  purchasePrice: number | null;
  createdAt: string;
  vendorName: string | null;
  vendorPhone: string | null;
  vendorEmail: string | null;
  purchaserName: string | null;
  purchaserPhone: string | null;
  purchaserEmail: string | null;
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diffMs / 86400000);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function parseDraftAddress(address: string): { streetAddress: string; city: string; postcode: string } {
  const parts = address.split(", ");
  const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s[0-9][A-Z]{2}$/;
  const remaining = [...parts];
  let postcode = "";
  let city = "";
  if (remaining.length > 0 && postcodeRegex.test(remaining[remaining.length - 1])) {
    postcode = remaining.pop()!;
  }
  if (remaining.length > 1) {
    city = remaining.pop()!;
  }
  return { streetAddress: remaining.join(", "), city, postcode };
}

function DraftFloatingPanel({
  drafts,
  onLoad,
  onDiscard,
}: {
  drafts: DraftEntry[];
  onLoad: (draft: DraftEntry) => void;
  onDiscard: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (drafts.length === 0) return null;
  return (
    <div style={{ position: "fixed", bottom: 24, left: 24, zIndex: 40 }}>
      {expanded ? (
        <div style={{ width: 320, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.45)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved Drafts</span>
              <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", borderRadius: 9999, padding: "1px 7px", fontWeight: 700 }}>{drafts.length}</span>
            </div>
            <button type="button" onClick={() => setExpanded(false)} style={{ color: "rgba(15,23,42,0.3)", lineHeight: 1, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {drafts.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 10px", background: "rgba(248,250,252,0.8)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.5)" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(15,23,42,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{d.propertyAddress}</p>
                  <p style={{ fontSize: 11, color: "rgba(15,23,42,0.35)", marginTop: 2, marginBottom: 0 }}>{relativeTime(d.createdAt)}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <button type="button" onClick={() => { onLoad(d); setExpanded(false); }} style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Edit</button>
                  <button type="button" onClick={() => onDiscard(d.id)} style={{ fontSize: 13, color: "rgba(15,23,42,0.25)", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 4px 20px rgba(0,0,0,0.14)", padding: "10px 16px", cursor: "pointer" }}
        >
          <span style={{ width: 20, height: 20, background: "#f59e0b", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg style={{ width: 11, height: 11, color: "white" }} fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(15,23,42,0.65)" }}>{drafts.length} saved draft{drafts.length > 1 ? "s" : ""}</span>
          <svg style={{ width: 13, height: 13, color: "rgba(15,23,42,0.3)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
        </button>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function NewTransactionForm({ userRole, redirectBase = "/transactions", recommendedFirmIds, recommendedFirms = [], initialDrafts = [] }: { userRole?: string; redirectBase?: string; recommendedFirmIds?: string[]; recommendedFirms?: { id: string; defaultReferralFeePence: number | null }[]; initialDrafts?: DraftEntry[] }) {
  const resolvedFirmIds = recommendedFirmIds ?? recommendedFirms.map((f) => f.id);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isAgent = userRole === "negotiator" || userRole === "director";
  const [showOverlay, setShowOverlay] = useState(false);
  const [progressedBy, setProgressedBy] = useState<"progressor" | "agent">("agent");

  const [form, setForm] = useState({
    streetAddress: "",
    city: "",
    postcode: "",
    purchasePrice: null as number | null,
    tenure: "" as Tenure | "",
    purchaseType: "" as PurchaseType | "",
    notes: "",
  });

  // Agent fee state
  const [agentFeeType, setAgentFeeType] = useState<"amount" | "percent">("amount");
  const [agentFeeAmount, setAgentFeeAmount] = useState<number | null>(null);
  const [agentFeePercentStr, setAgentFeePercentStr] = useState("");
  const [agentFeeVat, setAgentFeeVat] = useState<"inclusive" | "exclusive">("exclusive");

  const [vendors, setVendors] = useState<ContactEntry[]>([emptyContact()]);
  const [purchasers, setPurchasers] = useState<ContactEntry[]>([emptyContact()]);
  const [vendorSolicitor, setVendorSolicitor] = useState<SolicitorSelection | null>(null);
  const [purchaserSolicitor, setPurchaserSolicitor] = useState<SolicitorSelection | null>(null);
  const [vendorIsReferral, setVendorIsReferral] = useState(false);
  const [purchaserIsReferral, setPurchaserIsReferral] = useState(false);

  const [postcodeError, setPostcodeError] = useState("");
  const [priceWarning, setPriceWarning] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [localDrafts, setLocalDrafts] = useState<DraftEntry[]>(initialDrafts);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showNavModal, setShowNavModal] = useState(false);
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);

  // Memo of sale state
  const [memoStatus, setMemoStatus] = useState<MemoStatus>("idle");
  const [memoResult, setMemoResult] = useState<MemoResult | null>(null);
  const [memoError, setMemoError] = useState("");
  const [memoFields, setMemoFields] = useState<Set<string>>(new Set());
  const [memoSolicitorHints, setMemoSolicitorHints] = useState<{ vendor: string | null; purchaser: string | null }>({
    vendor: null,
    purchaser: null,
  });
  const [solicitorFillStatus, setSolicitorFillStatus] = useState<{ vendor: "new" | "existing" | null; purchaser: "new" | "existing" | null }>({
    vendor: null,
    purchaser: null,
  });
  const [mosStoragePath, setMosStoragePath] = useState<string | null>(null);
  const [mosFileSize, setMosFileSize] = useState<number | null>(null);
  const [mosMimeType, setMosMimeType] = useState<string | null>(null);
  const [mosFilename, setMosFilename] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorSolicitor || !resolvedFirmIds.includes(vendorSolicitor.firmId)) setVendorIsReferral(false);
  }, [vendorSolicitor, resolvedFirmIds]);

  useEffect(() => {
    if (!purchaserSolicitor || !resolvedFirmIds.includes(purchaserSolicitor.firmId)) setPurchaserIsReferral(false);
  }, [purchaserSolicitor, resolvedFirmIds]);

  function setField(field: string, value: string | number | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddressBlur() {
    if (form.streetAddress.trim()) setField("streetAddress", titleCase(form.streetAddress));
  }

  function handleCityBlur() {
    if (form.city.trim()) setField("city", titleCase(form.city));
  }

  function handlePostcodeBlur() {
    if (!form.postcode.trim()) { setPostcodeError(""); return; }
    const formatted = formatPostcode(form.postcode);
    setField("postcode", formatted);
    setPostcodeError(isValidUKPostcode(formatted) ? "" : "Doesn't look like a valid UK postcode");
  }

  function handlePriceChange(val: number | null) {
    setField("purchasePrice", val);
    if (val === null || val === 0) { setPriceWarning(""); return; }
    if (val < 1_000_000) setPriceWarning("This seems low for a property — double-check the figure");
    else if (val > 5_000_000_000) setPriceWarning("Price over £50m — please double-check");
    else setPriceWarning("");
  }

  async function autoFillSolicitor(
    firmName: string,
    contact: { name?: string | null; phone?: string | null; email?: string | null },
    setSolicitor: (v: SolicitorSelection | null) => void,
  ): Promise<"new" | "existing" | false> {
    try {
      const searchRes = await fetch(`/api/solicitor-firms?q=${encodeURIComponent(firmName)}`, { cache: "no-store" });
      if (!searchRes.ok) return false;
      const firms: { id: string; name: string }[] = await searchRes.json();
      const exact = firms.find(f => f.name.toLowerCase().trim() === firmName.toLowerCase().trim());

      if (exact) {
        let selection: SolicitorSelection = { firmId: exact.id, firmName: exact.name, contactId: null, contactName: null, phone: null, email: null };
        if (contact.name?.trim()) {
          const handlersRes = await fetch(`/api/solicitor-firms/${exact.id}/handlers`, { cache: "no-store" });
          const handlers: { id: string; name: string; phone: string | null; email: string | null }[] = handlersRes.ok ? await handlersRes.json() : [];
          const existingHandler = handlers.find(h => h.name.toLowerCase().trim() === contact.name!.toLowerCase().trim());
          if (existingHandler) {
            selection = { ...selection, contactId: existingHandler.id, contactName: existingHandler.name, phone: existingHandler.phone, email: existingHandler.email };
          } else {
            const createRes = await fetch(`/api/solicitor-firms/${exact.id}/handlers`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: contact.name.trim(), phone: contact.phone?.trim() || null, email: contact.email?.trim() || null }),
            });
            if (createRes.ok) {
              const h = await createRes.json();
              selection = { ...selection, contactId: h.id, contactName: h.name, phone: h.phone, email: h.email };
            }
          }
        }
        setSolicitor(selection);
        return "existing";
      }

      const createRes = await fetch("/api/solicitor-firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: firmName.trim(),
          ...(contact.name?.trim() ? { handler: { name: contact.name.trim(), phone: contact.phone?.trim() || null, email: contact.email?.trim() || null } } : {}),
        }),
      });
      if (!createRes.ok) return false;
      const newFirm = await createRes.json();
      const h = newFirm.handlers?.[0] ?? null;
      setSolicitor({ firmId: newFirm.id, firmName: newFirm.name, contactId: h?.id ?? null, contactName: h?.name ?? null, phone: h?.phone ?? null, email: h?.email ?? null });
      return "new";
    } catch {
      return false;
    }
  }

  async function handleMemoFile(file: File) {
    setMemoStatus("reading");
    setMemoError("");
    setMemoResult(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/agent/memo-parse", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setMemoStatus("error");
        setMemoError(data.error ?? "Failed to read document");
        return;
      }

      const filled: string[] = [];
      const missing: string[] = [];
      const newMemoFields = new Set<string>();

      function applyField(key: string, label: string, apply: () => void) {
        apply();
        newMemoFields.add(key);
        filled.push(label);
      }

      if (data.streetAddress) applyField("streetAddress", "address", () => setField("streetAddress", titleCase(data.streetAddress)));
      else missing.push("street address");

      if (data.city) applyField("city", "city", () => setField("city", titleCase(data.city)));

      if (data.postcode) {
        applyField("postcode", "postcode", () => {
          const pc = formatPostcode(data.postcode);
          setField("postcode", pc);
          setPostcodeError(isValidUKPostcode(pc) ? "" : "Doesn't look like a valid UK postcode");
        });
      } else {
        missing.push("postcode");
      }

      if (data.purchasePricePence) {
        applyField("purchasePrice", "price", () => handlePriceChange(data.purchasePricePence));
      } else {
        missing.push("purchase price");
      }

      if (data.tenure) {
        applyField("tenure", "tenure", () => setField("tenure", data.tenure));
      } else {
        missing.push("tenure");
      }

      // Vendors
      if (data.vendors?.length) {
        const populated = data.vendors.filter((v: { name: string }) => v.name?.trim());
        if (populated.length) {
          newMemoFields.add("vendors");
          filled.push(`${populated.length} vendor${populated.length > 1 ? "s" : ""}`);
          setVendors(populated.map((v: ContactEntry) => ({
            name: titleCase(v.name),
            phone: v.phone ? cleanPhone(v.phone) : "",
            email: v.email ?? "",
          })));
        } else {
          missing.push("vendor details");
        }
      } else {
        missing.push("vendor details");
      }

      // Purchasers
      if (data.purchasers?.length) {
        const populated = data.purchasers.filter((p: { name: string }) => p.name?.trim());
        if (populated.length) {
          newMemoFields.add("purchasers");
          filled.push(`${populated.length} purchaser${populated.length > 1 ? "s" : ""}`);
          setPurchasers(populated.map((p: ContactEntry) => ({
            name: titleCase(p.name),
            phone: p.phone ? cleanPhone(p.phone) : "",
            email: p.email ?? "",
          })));
        } else {
          missing.push("purchaser details");
        }
      } else {
        missing.push("purchaser details");
      }

      // Solicitors — look up in DB (or create), fill handler too
      const solHints = {
        vendor: data.vendorSolicitor?.firm ?? null,
        purchaser: data.purchaserSolicitor?.firm ?? null,
      };
      setMemoSolicitorHints(solHints);

      const [vendorResult, purchaserResult] = await Promise.all([
        data.vendorSolicitor?.firm
          ? autoFillSolicitor(data.vendorSolicitor.firm, { name: data.vendorSolicitor.name, phone: data.vendorSolicitor.phone, email: data.vendorSolicitor.email }, setVendorSolicitor)
          : Promise.resolve(false as const),
        data.purchaserSolicitor?.firm
          ? autoFillSolicitor(data.purchaserSolicitor.firm, { name: data.purchaserSolicitor.name, phone: data.purchaserSolicitor.phone, email: data.purchaserSolicitor.email }, setPurchaserSolicitor)
          : Promise.resolve(false as const),
      ]);

      setSolicitorFillStatus({ vendor: vendorResult || null, purchaser: purchaserResult || null });

      if (vendorResult) { filled.push("seller's solicitor"); newMemoFields.add("vendorSolicitor"); }
      else missing.push("seller's solicitor");
      if (purchaserResult) { filled.push("buyer's solicitor"); newMemoFields.add("purchaserSolicitor"); }
      else missing.push("buyer's solicitor");
      missing.push("purchase type"); // never on a memo

      setMemoFields(newMemoFields);
      setMemoStatus("done");
      setMemoResult({ filled, missing, vendorSolicitorFirm: solHints.vendor, purchaserSolicitorFirm: solHints.purchaser });
      if (data.mosStoragePath) {
        setMosStoragePath(data.mosStoragePath);
        setMosFileSize(data.mosFileSize ?? null);
        setMosMimeType(data.mosMimeType ?? null);
        setMosFilename(data.mosFilename ?? null);
      }
    } catch {
      setMemoStatus("error");
      setMemoError("Couldn't connect — please try again");
    }
  }

  function dismissMemo() {
    setMemoStatus("idle");
    setMemoResult(null);
    setMemoError("");
    setMemoFields(new Set());
    setMemoSolicitorHints({ vendor: null, purchaser: null });
    setSolicitorFillStatus({ vendor: null, purchaser: null });
    setMosStoragePath(null);
    setMosFileSize(null);
    setMosMimeType(null);
    setMosFilename(null);
  }

  function resetForm() {
    setForm({ streetAddress: "", city: "", postcode: "", purchasePrice: null, tenure: "", purchaseType: "", notes: "" });
    setVendors([emptyContact()]);
    setPurchasers([emptyContact()]);
    setVendorSolicitor(null);
    setPurchaserSolicitor(null);
    setVendorIsReferral(false);
    setPurchaserIsReferral(false);
    setAgentFeeAmount(null);
    setAgentFeePercentStr("");
    setCurrentDraftId(null);
    dismissMemo();
  }

  async function handleSaveDraft() {
    if (draftSaving) return;
    setDraftSaving(true);
    try {
      const address = [form.streetAddress, form.city, form.postcode].filter(Boolean).join(", ");
      const result = await saveDraftAction({
        draftId: currentDraftId ?? undefined,
        propertyAddress: address || "Untitled draft",
        tenure: (form.tenure as Tenure) || null,
        purchaseType: (form.purchaseType as PurchaseType) || null,
        purchasePrice: form.purchasePrice,
        vendorName: vendors[0]?.name.trim() || undefined,
        vendorPhone: vendors[0]?.phone.trim() || undefined,
        vendorEmail: vendors[0]?.email.trim() || undefined,
        purchaserName: purchasers[0]?.name.trim() || undefined,
        purchaserPhone: purchasers[0]?.phone.trim() || undefined,
        purchaserEmail: purchasers[0]?.email.trim() || undefined,
        progressedBy,
      });
      const savedDraft: DraftEntry = {
        id: result.id,
        propertyAddress: address || "Untitled draft",
        tenure: form.tenure || null,
        purchaseType: form.purchaseType || null,
        purchasePrice: form.purchasePrice,
        createdAt: new Date().toISOString(),
        vendorName: vendors[0]?.name.trim() || null,
        vendorPhone: vendors[0]?.phone.trim() || null,
        vendorEmail: vendors[0]?.email.trim() || null,
        purchaserName: purchasers[0]?.name.trim() || null,
        purchaserPhone: purchasers[0]?.phone.trim() || null,
        purchaserEmail: purchasers[0]?.email.trim() || null,
      };
      if (currentDraftId) {
        setLocalDrafts((prev) => {
          const exists = prev.some((d) => d.id === currentDraftId);
          return exists
            ? prev.map((d) => (d.id === currentDraftId ? savedDraft : d))
            : [savedDraft, ...prev];
        });
      } else {
        setLocalDrafts((prev) => [savedDraft, ...prev]);
      }
      resetForm();
    } finally {
      setDraftSaving(false);
    }
  }

  async function handleDiscardDraft(draftId: string) {
    await discardDraftAction(draftId);
    setLocalDrafts((prev) => prev.filter((d) => d.id !== draftId));
    if (currentDraftId === draftId) setCurrentDraftId(null);
  }

  function handleLoadDraft(draft: DraftEntry) {
    const parsed = parseDraftAddress(draft.propertyAddress);
    setForm({
      streetAddress: parsed.streetAddress,
      city: parsed.city,
      postcode: parsed.postcode,
      purchasePrice: draft.purchasePrice ?? null,
      tenure: (draft.tenure as Tenure) ?? "",
      purchaseType: (draft.purchaseType as PurchaseType) ?? "",
      notes: "",
    });
    setVendors(draft.vendorName ? [{ name: draft.vendorName, phone: draft.vendorPhone ?? "", email: draft.vendorEmail ?? "" }] : [emptyContact()]);
    setPurchasers(draft.purchaserName ? [{ name: draft.purchaserName, phone: draft.purchaserPhone ?? "", email: draft.purchaserEmail ?? "" }] : [emptyContact()]);
    setVendorSolicitor(null);
    setPurchaserSolicitor(null);
    setCurrentDraftId(draft.id);
    setLocalDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleNavSaveDraft() {
    setShowNavModal(false);
    const href = pendingNavHref;
    setPendingNavHref(null);
    await handleSaveDraft();
    if (href) router.push(href);
  }

  function handleNavLeave() {
    setShowNavModal(false);
    const href = pendingNavHref;
    setPendingNavHref(null);
    if (href) router.push(href);
  }

  function handleNavStay() {
    setShowNavModal(false);
    setPendingNavHref(null);
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending || !form.streetAddress || !form.tenure || !form.purchaseType) return;

    const address = [form.streetAddress, form.city, form.postcode].filter(Boolean).join(", ");
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

    const feeAmount = isAgent && agentFeeType === "amount" ? agentFeeAmount : null;
    const feePercent = isAgent && agentFeeType === "percent" && agentFeePercentStr ? parseFloat(agentFeePercentStr) : null;
    const feeVatInclusive = isAgent && (feeAmount != null || feePercent != null) ? agentFeeVat === "inclusive" : null;

    const referredFirmId = vendorIsReferral && vendorSolicitor
      ? vendorSolicitor.firmId
      : purchaserIsReferral && purchaserSolicitor
      ? purchaserSolicitor.firmId
      : null;

    const referralFee = referredFirmId
      ? (recommendedFirms.find((f) => f.id === referredFirmId)?.defaultReferralFeePence ?? null)
      : null;

    setShowOverlay(true);
    startTransition(async () => {
      const result = await createTransactionAction({
        propertyAddress: address,
        purchasePrice: form.purchasePrice ?? null,
        tenure: (form.tenure as Tenure) || null,
        purchaseType: (form.purchaseType as PurchaseType) || null,
        notes: form.notes.trim() || null,
        progressedBy: isAgent ? progressedBy : "progressor",
        contacts,
        vendorSolicitorFirmId: vendorSolicitor?.firmId ?? null,
        vendorSolicitorContactId: vendorSolicitor?.contactId ?? null,
        purchaserSolicitorFirmId: purchaserSolicitor?.firmId ?? null,
        purchaserSolicitorContactId: purchaserSolicitor?.contactId ?? null,
        agentFeeAmount: feeAmount,
        agentFeePercent: feePercent,
        agentFeeIsVatInclusive: feeVatInclusive,
        referredFirmId,
        referralFee,
        mosUploaded: memoStatus === "done",
        mosStoragePath: mosStoragePath ?? undefined,
        mosFileSize: mosFileSize ?? undefined,
        mosMimeType: mosMimeType ?? undefined,
        mosFilename: mosFilename ?? undefined,
      });
      const dest = result.mosAutoConfirmed
        ? `${redirectBase}/${result.id}?mosConfirmed=1`
        : `${redirectBase}/${result.id}?newFile=1`;
      router.push(dest);
    });
  }

  const hasVendor = vendors.some((v) => v.name.trim());
  const hasPurchaser = purchasers.some((p) => p.name.trim());
  const requiresContacts = isAgent && progressedBy === "progressor";
  // When outsourcing, every named contact must have at least a phone or email
  const vendorContactsValid = vendors.every((v) => !v.name.trim() || v.phone.trim() || v.email.trim());
  const purchaserContactsValid = purchasers.every((p) => !p.name.trim() || p.phone.trim() || p.email.trim());
  const contactMethodsValid = !requiresContacts || (vendorContactsValid && purchaserContactsValid);
  const canSubmit = !!form.streetAddress && !!form.tenure && !!form.purchaseType &&
    (!requiresContacts || (hasVendor && hasPurchaser)) &&
    contactMethodsValid;

  const overlayAddress = [form.streetAddress, form.city].filter(Boolean).join(", ");

  const hasData = !!(
    form.streetAddress.trim() ||
    form.city.trim() ||
    form.postcode.trim() ||
    form.purchasePrice ||
    form.tenure ||
    form.purchaseType ||
    vendors.some((v) => v.name.trim()) ||
    purchasers.some((p) => p.name.trim()) ||
    vendorSolicitor ||
    purchaserSolicitor
  );

  useEffect(() => {
    if (!hasData) return;
    function unloadHandler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", unloadHandler);
    return () => window.removeEventListener("beforeunload", unloadHandler);
  }, [hasData]);

  useEffect(() => {
    if (!hasData) return;
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
  }, [hasData]);

  return (
    <>
      {showOverlay && <CreatingOverlay address={overlayAddress} />}

      {showNavModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", animation: "overlayFadeIn 0.18s ease-out both" }}
          onClick={handleNavStay}
        >
          <div
            style={{ background: "rgba(255,255,255,0.98)", borderRadius: 24, padding: "32px 28px", maxWidth: 380, width: "100%", margin: "0 16px", boxShadow: "0 24px 64px rgba(0,0,0,0.28)", animation: "cardSlideUp 0.28s cubic-bezier(0.34,1.56,0.64,1) both", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 52, height: 52, background: "linear-gradient(135deg, #f59e0b, #d97706)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg style={{ width: 24, height: 24 }} fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "rgba(15,23,42,0.85)", marginBottom: 8, marginTop: 0 }}>Save your progress?</h2>
            <p style={{ fontSize: 14, color: "rgba(15,23,42,0.5)", marginBottom: 24, lineHeight: 1.6 }}>You&apos;ve started filling in transaction details. Save as a draft to pick up where you left off.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button type="button" onClick={handleNavSaveDraft} disabled={draftSaving} style={{ padding: "11px 16px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white", borderRadius: 12, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer", opacity: draftSaving ? 0.6 : 1 }}>
                {draftSaving ? "Saving…" : "Save as draft"}
              </button>
              <button type="button" onClick={handleNavLeave} style={{ padding: "11px 16px", background: "transparent", color: "rgba(15,23,42,0.5)", borderRadius: 12, fontWeight: 500, fontSize: 14, border: "1px solid rgba(15,23,42,0.12)", cursor: "pointer" }}>
                Leave without saving
              </button>
              <button type="button" onClick={handleNavStay} style={{ padding: "8px 16px", background: "transparent", color: "rgba(15,23,42,0.3)", fontSize: 13, border: "none", cursor: "pointer" }}>
                Stay on this page
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit}>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div className="glass-card p-6 space-y-6">

            {/* Memo upload */}
            <MemoUploadBanner
              status={memoStatus}
              result={memoResult}
              error={memoError}
              onFile={handleMemoFile}
              onDismiss={dismissMemo}
            />

            {/* Address */}
            <div>
              <h2 className="glass-section-label text-slate-900/40 mb-3">Property Address</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-900/60 mb-1.5">
                    Street address <span className="text-red-400">*</span>
                    {memoFields.has("streetAddress") && <MemoTag />}
                  </label>
                  <input
                    value={form.streetAddress}
                    onChange={(e) => setField("streetAddress", e.target.value)}
                    onBlur={handleAddressBlur}
                    placeholder="e.g. 14 Elmwood Avenue"
                    maxLength={120}
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-900/60 mb-1.5">
                      City / Town
                      {memoFields.has("city") && <MemoTag />}
                    </label>
                    <input
                      value={form.city}
                      onChange={(e) => setField("city", e.target.value)}
                      onBlur={handleCityBlur}
                      placeholder="e.g. Bristol"
                      maxLength={60}
                      className="glass-input w-full px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-900/60 mb-1.5">
                      Postcode
                      {memoFields.has("postcode") && <MemoTag />}
                    </label>
                    <input
                      value={form.postcode}
                      onChange={(e) => setField("postcode", e.target.value.toUpperCase())}
                      onBlur={handlePostcodeBlur}
                      placeholder="e.g. BS6 7TH"
                      maxLength={8}
                      className={`glass-input w-full px-3 py-2.5 text-sm ${postcodeError ? "border-amber-400" : ""}`}
                    />
                    {postcodeError && (
                      <p className="text-xs text-amber-500 mt-1">{postcodeError}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tenure */}
            <div>
              <h2 className="glass-section-label text-slate-900/40 mb-3">
                Tenure <span className="text-red-400">*</span>
                {memoFields.has("tenure") && <MemoTag />}
              </h2>
              <div className="flex gap-3">
                {([
                  ["freehold", "Freehold", "Management pack not required"],
                  ["leasehold", "Leasehold", "Management pack required"],
                ] as [Tenure, string, string][]).map(([value, label, note]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setField("tenure", value)}
                    className={`flex-1 py-3.5 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                      form.tenure === value
                        ? "border-blue-400 bg-blue-50/60 text-blue-700"
                        : "border-white/30 text-slate-900/50 hover:border-white/50"
                    }`}
                  >
                    {label}
                    <span className="text-xs font-normal text-slate-900/40">{note}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Purchase type */}
            <div>
              <h2 className="glass-section-label text-slate-900/40 mb-3">Purchase Type <span className="text-red-400">*</span></h2>
              <div className="flex flex-col gap-2">
                {([
                  ["mortgage", "Mortgage", "All mortgage milestones apply"],
                  ["cash_buyer", "Cash", "Mortgage milestones not required"],
                  ["cash_from_proceeds", "Cash from Proceeds", "Mortgage + deposit not required"],
                ] as [PurchaseType, string, string][]).map(([value, label, note]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setField("purchaseType", value)}
                    className={`w-full py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
                      form.purchaseType === value
                        ? "border-blue-400 bg-blue-50/60 text-blue-700"
                        : "border-white/30 text-slate-900/50 hover:border-white/50"
                    }`}
                  >
                    {label}
                    <span className="text-xs font-normal text-slate-900/40 sm:text-right">{note}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Purchase price */}
            <div>
              <h2 className="glass-section-label text-slate-900/40 mb-3">
                Purchase Price
                {memoFields.has("purchasePrice") && <MemoTag />}
              </h2>
              <div className="flex items-center gap-2">
                <PriceInput
                  value={form.purchasePrice}
                  onChange={handlePriceChange}
                  className="w-48"
                />
                <span className="text-xs text-slate-900/40">Optional</span>
              </div>
              {priceWarning && (
                <p className="text-xs text-amber-500 mt-1.5">{priceWarning}</p>
              )}
            </div>

            {/* Agent fee — agents only */}
            {isAgent && (
              <div>
                <h2 className="glass-section-label text-slate-900/40 mb-3">Your Fee <span className="text-slate-900/30 font-normal normal-case">(optional)</span></h2>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAgentFeeType("amount")}
                      className={`flex-1 py-2 text-xs rounded-lg border-2 font-medium transition-colors ${agentFeeType === "amount" ? "border-blue-400 bg-blue-50/60 text-blue-700" : "border-white/30 text-slate-900/50 hover:border-white/50"}`}
                    >
                      Fixed £
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgentFeeType("percent")}
                      className={`flex-1 py-2 text-xs rounded-lg border-2 font-medium transition-colors ${agentFeeType === "percent" ? "border-blue-400 bg-blue-50/60 text-blue-700" : "border-white/30 text-slate-900/50 hover:border-white/50"}`}
                    >
                      % of sale price
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {agentFeeType === "amount" ? (
                      <PriceInput
                        value={agentFeeAmount}
                        onChange={setAgentFeeAmount}
                        className="w-40"
                        placeholder="e.g. 3,000"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={agentFeePercentStr}
                          onChange={(e) => setAgentFeePercentStr(e.target.value)}
                          placeholder="e.g. 1.5"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          max="10"
                          className="glass-input w-28 px-3 py-2 text-sm"
                        />
                        <span className="text-sm text-slate-900/50">%</span>
                      </div>
                    )}
                    <select
                      value={agentFeeVat}
                      onChange={(e) => setAgentFeeVat(e.target.value as "inclusive" | "exclusive")}
                      className="glass-input px-2 py-2 text-sm"
                    >
                      <option value="exclusive">+ VAT</option>
                      <option value="inclusive">Inc. VAT</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <h2 className="glass-section-label text-slate-900/40 mb-3">Notes</h2>
              <textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Any context about this transaction…"
                rows={3}
                className="glass-input w-full px-3 py-2.5 text-sm resize-none"
              />
            </div>

            {/* Who progresses? — agents only */}
            {isAgent && (
              <div>
                <h2 className="glass-section-label text-slate-900/40 mb-3">Who will progress this file?</h2>
                <div className="flex gap-3">
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
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={!canSubmit || isPending}
                className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? "Creating…" : "Create transaction"}
              </button>
              {!canSubmit && (
                <p className="text-xs text-slate-900/40 mt-2">
                  {requiresContacts && !hasVendor && !hasPurchaser
                    ? "Add at least one vendor and one purchaser before sending to a progressor"
                    : requiresContacts && !hasVendor
                    ? "Add at least one vendor before sending to a progressor"
                    : requiresContacts && !hasPurchaser
                    ? "Add at least one purchaser before sending to a progressor"
                    : requiresContacts && !vendorContactsValid
                    ? "Add a phone or email for each vendor — we need a way to contact them"
                    : requiresContacts && !purchaserContactsValid
                    ? "Add a phone or email for each purchaser — we need a way to contact them"
                    : "Address, tenure and purchase type are required"}
                </p>
              )}
              {hasData && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={draftSaving}
                  style={{ marginTop: 12, display: "block", fontSize: 12, color: "rgba(15,23,42,0.3)", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
                >
                  {draftSaving ? "Saving…" : currentDraftId ? "↑ Update draft" : "↓ Save as draft"}
                </button>
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
                fromMemo={memoFields.has("vendors")}
                onChange={(i, f, v) => updateContact(vendors, setVendors, i, f, v)}
                onAdd={() => addContact(vendors, setVendors)}
                onRemove={(i) => removeContact(vendors, setVendors, i)}
              />
              <div className="border-t border-white/20" />
              <ContactSection
                label="Purchasers"
                contacts={purchasers}
                fromMemo={memoFields.has("purchasers")}
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
                  <div>
                    <SolicitorPicker label="Seller's Solicitor" value={vendorSolicitor} onChange={setVendorSolicitor} />
                    {vendorSolicitor && resolvedFirmIds.includes(vendorSolicitor.firmId) && (
                      <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={vendorIsReferral}
                          onChange={(e) => setVendorIsReferral(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-emerald-600"
                        />
                        <span className="text-xs font-medium text-emerald-700">Referred by us</span>
                      </label>
                    )}
                    {solicitorFillStatus.vendor === "new" && (
                      <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        Solicitor added to your database
                      </p>
                    )}
                    {solicitorFillStatus.vendor === "existing" && (
                      <p className="text-xs text-blue-500 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Solicitor filled from your database
                      </p>
                    )}
                    {memoSolicitorHints.vendor && !vendorSolicitor && (
                      <p className="text-xs text-violet-500 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Memo mentions <strong className="font-semibold">{memoSolicitorHints.vendor}</strong> — search above to add
                      </p>
                    )}
                  </div>
                  <div className="border-t border-white/20" />
                  <div>
                    <SolicitorPicker label="Buyer's Solicitor" value={purchaserSolicitor} onChange={setPurchaserSolicitor} />
                    {purchaserSolicitor && resolvedFirmIds.includes(purchaserSolicitor.firmId) && (
                      <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={purchaserIsReferral}
                          onChange={(e) => setPurchaserIsReferral(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-emerald-600"
                        />
                        <span className="text-xs font-medium text-emerald-700">Referred by us</span>
                      </label>
                    )}
                    {solicitorFillStatus.purchaser === "new" && (
                      <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        Solicitor added to your database
                      </p>
                    )}
                    {solicitorFillStatus.purchaser === "existing" && (
                      <p className="text-xs text-blue-500 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Solicitor filled from your database
                      </p>
                    )}
                    {memoSolicitorHints.purchaser && !purchaserSolicitor && (
                      <p className="text-xs text-violet-500 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Memo mentions <strong className="font-semibold">{memoSolicitorHints.purchaser}</strong> — search above to add
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </form>

      <DraftFloatingPanel drafts={localDrafts} onLoad={handleLoadDraft} onDiscard={handleDiscardDraft} />
    </>
  );
}

// ── Contact section ───────────────────────────────────────────────────────────

type ContactSectionProps = {
  label: string;
  contacts: ContactEntry[];
  fromMemo?: boolean;
  onChange: (index: number, field: keyof ContactEntry, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

function ContactSection({ label, contacts, fromMemo, onChange, onAdd, onRemove }: ContactSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide flex items-center">
          {label}
          {fromMemo && <MemoTag />}
        </h2>
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
                onBlur={(e) => { if (e.target.value.trim()) onChange(i, "name", titleCase(e.target.value)); }}
                placeholder="e.g. John Smith"
                maxLength={80}
                className="glass-input w-full px-3 py-2.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-900/60 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => onChange(i, "phone", cleanPhone(e.target.value))}
                  placeholder="e.g. 07700 900000"
                  maxLength={20}
                  className="glass-input w-full px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-900/60 mb-1.5">Email</label>
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => onChange(i, "email", e.target.value)}
                  placeholder="e.g. john@email.com"
                  maxLength={100}
                  className="glass-input w-full px-3 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
