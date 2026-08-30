"use client";

// The editable "file hero" on the New Sale form — the full-width top element,
// mirroring the property-file hero. It replaces the demo hero (which fades out
// as this fades in) and is the single surface for the core sale details: photo,
// address, price, tenure, purchase type and who's progressing it. Everything
// fills in live and there's no separate step-1 form.
//
// The photo reuses the property-file treatment exactly: the neutral hollow
// add-circle, and on upload the zone widens while the image fades in behind a
// right-edge mask (see components/transaction/HeroPhotoUpload.tsx + PropertyHero).
// Since there's no file yet, it uploads against an on-demand draft (ensureDraft);
// the storage path is carried onto the new file on submit.

import { useRef, useState } from "react";
import { PencilSimple, ArrowRight } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { PriceInput } from "@/components/ui/PriceInput";
import { Pill } from "@/components/ui/Pill";
import { AddPhotoCircle } from "@/components/transaction/HeroPhotoUpload";
import { AddressFields } from "@/components/transactions-v2/form/AddressFields";
import { prepareImageForUpload, describeUploadError, SAFE_UPLOAD_BYTES } from "@/lib/images/prepare-upload";
import type { FormFields } from "@/components/transactions-v2/form/types";

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

const TENURES: { value: "freehold" | "leasehold"; label: string }[] = [
  { value: "freehold", label: "Freehold" },
  { value: "leasehold", label: "Leasehold" },
];
const PURCHASE_TYPES: { value: "mortgage" | "cash_buyer" | "cash_from_proceeds"; label: string }[] = [
  { value: "mortgage", label: "Mortgage" },
  { value: "cash_buyer", label: "Cash" },
  { value: "cash_from_proceeds", label: "Cash from proceeds" },
];

// A selectable pill chip with a clear hover + selected state.
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex" }}
    >
      <Pill
        glass={selected}
        tone={selected ? "brand" : "muted"}
        outline={!selected}
        size="md"
        style={{
          cursor: "pointer",
          transition: "background-color 120ms, border-color 120ms, color 120ms",
          ...(!selected && hover ? { backgroundColor: "rgba(var(--agent-coral-rgb), 0.08)", borderColor: "rgba(var(--agent-coral-rgb), 0.35)", color: "var(--agent-coral-deep)" } : {}),
        }}
      >
        {children}
      </Pill>
    </button>
  );
}

// Small group label with a "needed" cue while the group has no selection.
function GroupLabel({ children, needed }: { children: React.ReactNode; needed: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: needed ? "var(--agent-warning)" : "var(--agent-text-muted)" }}>
      {children}
      {needed && <span style={{ fontSize: 10, fontWeight: 600 }}>· pick one</span>}
    </span>
  );
}

export function SaleHeroEditable({
  fields, onUpdate, currentDraftId, ensureDraft, canOutsource = true,
  showContinue = false, onContinue, showMemoFooter = false, onChangeFile,
}: {
  fields: FormFields;
  onUpdate: (u: Partial<FormFields>) => void;
  currentDraftId: string | null;
  ensureDraft: () => Promise<string | null>;
  canOutsource?: boolean;
  showContinue?: boolean;
  onContinue?: () => void;
  showMemoFooter?: boolean;
  onChangeFile?: () => void;
}) {
  const { toast } = useAgentToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState<boolean>(!!fields.photoStoragePath);
  const [busy, setBusy] = useState(false);

  const addressLine = [fields.streetAddress, fields.city, fields.postcode].map((s) => s.trim()).filter(Boolean).join(", ");
  const [editingAddress, setEditingAddress] = useState<boolean>(!addressLine);

  const tenureNeeded = !fields.tenure;
  const purchaseNeeded = !fields.purchaseType;

  // Fields the memo left blank / still needed — surfaced in the hero footer.
  const missing = [
    !addressLine && "Address",
    fields.purchasePricePence == null && "Price",
    tenureNeeded && "Tenure",
    purchaseNeeded && "Purchase type",
  ].filter(Boolean) as string[];

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const draftId = currentDraftId ?? await ensureDraft();
      if (!draftId) { toast.error("We couldn't start a draft to attach the photo. Try again."); return; }
      const { file: prepared, reencoded } = await prepareImageForUpload(file);
      if (!reencoded && prepared.size > SAFE_UPLOAD_BYTES) {
        toast.error("That image is too large. Please use one under 4 MB, or a JPG or PNG.");
        return;
      }
      const form = new FormData();
      form.append("transactionId", draftId);
      form.append("file", prepared);
      const res = await fetch("/api/agent/upload-property-photo", { method: "POST", body: form });
      if (!res.ok) { toast.error(await describeUploadError(res)); return; }
      const json = await res.json();
      setDisplayUrl(json.url);
      requestAnimationFrame(() => requestAnimationFrame(() => setHasPhoto(true)));
      onUpdate({ photoStoragePath: json.storagePath });
    } catch {
      toast.error("We couldn't upload that photo. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removePhoto() {
    setHasPhoto(false);
    setTimeout(() => setDisplayUrl(null), 620);
    onUpdate({ photoStoragePath: null });
  }

  return (
    <div className="agent-glass-strong" style={{ position: "relative", overflow: "hidden", borderRadius: "var(--agent-radius-xl)", display: "flex", flexWrap: "wrap", animation: "agent-section-in 320ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) both" }}>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

      {/* Photo zone — exact property-file treatment: narrow zone widens on upload,
          image revealed left-to-right behind a right-edge mask, circle fades out. */}
      <div style={{
        position: "relative", flexGrow: 0, flexShrink: 1,
        flexBasis: hasPhoto ? 380 : 168, minWidth: hasPhoto ? 240 : 168,
        alignSelf: "stretch", overflow: "hidden",
        transition: `flex-basis 560ms ${EASE}, min-width 560ms ${EASE}`,
      }}>
        {displayUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt="" style={{
            position: "absolute", left: 0, top: 0, height: "100%", width: 380, maxWidth: "none",
            objectFit: "cover", opacity: hasPhoto ? 1 : 0,
            maskImage: "linear-gradient(to right, #000 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, #000 55%, transparent 100%)",
            transition: `opacity 560ms ${EASE}`, pointerEvents: "none",
          }} />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: hasPhoto ? 0 : 1, pointerEvents: hasPhoto ? "none" : "auto", transition: "opacity 300ms ease" }}>
          <AddPhotoCircle onClick={() => { if (!busy) inputRef.current?.click(); }} busy={busy} size={120} />
        </div>
        {hasPhoto && (
          <button type="button" onClick={removePhoto} className="agent-btn agent-btn-secondary agent-btn-sm" style={{ position: "absolute", bottom: 12, left: 12, zIndex: 2 }}>
            Remove photo
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: "1 1 340px", minWidth: 0, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Address */}
        {editingAddress ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AddressFields
              streetAddress={fields.streetAddress}
              city={fields.city}
              postcode={fields.postcode}
              onStreetAddressChange={(v) => onUpdate({ streetAddress: v })}
              onCityChange={(v) => onUpdate({ city: v })}
              onPostcodeChange={(v) => onUpdate({ postcode: v })}
            />
            {addressLine && (
              <button type="button" onClick={() => setEditingAddress(false)} className="agent-btn agent-btn-secondary agent-btn-sm" style={{ width: "fit-content" }}>Done</button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: "var(--agent-text-h2, 22px)", fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.2 }}>{addressLine}</p>
            <button type="button" onClick={() => setEditingAddress(true)} aria-label="Edit address" style={{ flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer", color: "var(--agent-text-muted)" }}>
              <PencilSimple size={15} weight="regular" />
            </button>
          </div>
        )}

        {/* Price */}
        <div>
          <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 700, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Sale price</p>
          <PriceInput value={fields.purchasePricePence} onChange={(v) => onUpdate({ purchasePricePence: v })} placeholder="Add the sale price" className="price-hero-input" />
        </div>

        {/* Tenure */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <GroupLabel needed={tenureNeeded}>Tenure</GroupLabel>
          {TENURES.map((t) => (
            <Choice key={t.value} selected={fields.tenure === t.value} onClick={() => onUpdate({ tenure: t.value })}>{t.label}</Choice>
          ))}
        </div>

        {/* Purchase type */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <GroupLabel needed={purchaseNeeded}>Purchase type</GroupLabel>
          {PURCHASE_TYPES.map((p) => (
            <Choice key={p.value} selected={fields.purchaseType === p.value} onClick={() => onUpdate({ purchaseType: p.value })}>{p.label}</Choice>
          ))}
        </div>

        {/* Progressed by */}
        {canOutsource && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)" }}>Progressed by</span>
            <Choice selected={fields.progressedBy === "agent"} onClick={() => onUpdate({ progressedBy: "agent" })}>Self-progress</Choice>
            <Choice selected={fields.progressedBy === "progressor"} onClick={() => onUpdate({ progressedBy: "progressor" })}>Send to us</Choice>
          </div>
        )}

        {/* Memo footer — replaces the separate "Memo read" card */}
        {showMemoFooter && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingTop: 12, marginTop: 2, borderTop: "0.5px solid var(--nv2-border-dark)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>Memo read</span>
            {missing.length > 0 ? (
              <>
                <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>· still needed:</span>
                {missing.map((m) => (
                  <Pill key={m} glass tone="warning" size="sm">{m}</Pill>
                ))}
              </>
            ) : (
              <span style={{ fontSize: 12, color: "var(--agent-success)" }}>· all set</span>
            )}
            {onChangeFile && (
              <button type="button" onClick={onChangeFile} className="agent-link agent-link-muted" style={{ marginLeft: "auto", fontSize: 12 }}>
                Change file
              </button>
            )}
          </div>
        )}

        {/* Continue (manual gate) */}
        {showContinue && (
          <button type="button" onClick={onContinue} className="agent-btn agent-btn-primary agent-btn-md" style={{ width: "fit-content", gap: 8 }}>
            Continue to details
            <ArrowRight size={15} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}
