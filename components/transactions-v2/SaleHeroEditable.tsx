"use client";

// The editable "file hero" on the New Sale form — the full-width top element,
// mirroring the property-file hero. It replaces the demo hero (which fades out
// as this fades in) and is the single surface for the core sale details: photo,
// address, price, tenure, purchase type and who's progressing it. Everything
// fills in live and there's no separate step-1 form.
//
// The photo uses the real upload flow against an on-demand draft (ensureDraft),
// since there's no file yet; the storage path is carried onto the new file on
// submit. See components/transaction/HeroPhotoUpload.tsx for the file-page one.

import { useRef, useState } from "react";
import { Camera, PencilSimple, X, ArrowRight, CircleNotch } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { PriceInput } from "@/components/ui/PriceInput";
import { Pill } from "@/components/ui/Pill";
import { AddressFields } from "@/components/transactions-v2/form/AddressFields";
import { prepareImageForUpload, describeUploadError, SAFE_UPLOAD_BYTES } from "@/lib/images/prepare-upload";
import type { FormFields } from "@/components/transactions-v2/form/types";

const TENURES: { value: "freehold" | "leasehold"; label: string }[] = [
  { value: "freehold", label: "Freehold" },
  { value: "leasehold", label: "Leasehold" },
];
const PURCHASE_TYPES: { value: "mortgage" | "cash_buyer" | "cash_from_proceeds"; label: string }[] = [
  { value: "mortgage", label: "Mortgage" },
  { value: "cash_buyer", label: "Cash" },
  { value: "cash_from_proceeds", label: "Cash from proceeds" },
];

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex" }}>
      <Pill glass={selected} tone={selected ? "brand" : "muted"} outline={!selected} size="md" style={{ cursor: "pointer" }}>
        {children}
      </Pill>
    </button>
  );
}

export function SaleHeroEditable({
  fields, onUpdate, currentDraftId, ensureDraft, canOutsource = true, showContinue = false, onContinue,
}: {
  fields: FormFields;
  onUpdate: (u: Partial<FormFields>) => void;
  currentDraftId: string | null;
  ensureDraft: () => Promise<string | null>;
  canOutsource?: boolean;
  showContinue?: boolean;
  onContinue?: () => void;
}) {
  const { toast } = useAgentToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState<boolean>(!!fields.photoStoragePath);
  const [busy, setBusy] = useState(false);

  const addressLine = [fields.streetAddress, fields.city, fields.postcode].map((s) => s.trim()).filter(Boolean).join(", ");
  const [editingAddress, setEditingAddress] = useState<boolean>(!addressLine);

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
      toast.success("Photo added");
    } catch {
      toast.error("We couldn't upload that photo. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removePhoto() {
    setHasPhoto(false);
    setTimeout(() => setDisplayUrl(null), 300);
    onUpdate({ photoStoragePath: null });
  }

  return (
    <div className="agent-glass-strong" style={{ position: "relative", overflow: "hidden", borderRadius: "var(--agent-radius-xl)", display: "flex", flexWrap: "wrap", animation: "agent-section-in 320ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) both" }}>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

      {/* Photo zone */}
      <div style={{ position: "relative", flex: "0 0 auto", width: 200, minHeight: 196, background: hasPhoto ? "transparent" : "linear-gradient(135deg, rgba(var(--agent-coral-rgb),0.16), rgba(var(--agent-coral-rgb),0.05))", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {hasPhoto && displayUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: hasPhoto ? 1 : 0, transition: "opacity 400ms ease" }} />
            <button type="button" onClick={removePhoto} aria-label="Remove photo" className="agent-icon-btn agent-icon-btn-sm" style={{ position: "absolute", top: 8, left: 8, zIndex: 2 }}>
              <X size={13} weight="bold" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => { if (!busy) inputRef.current?.click(); }} disabled={busy} aria-label="Add a property photo" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: busy ? "wait" : "pointer", color: "var(--agent-coral-deep)" }}>
            <span style={{ width: 50, height: 50, borderRadius: "50%", border: "2px dashed rgba(var(--agent-coral-rgb),0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {busy ? <CircleNotch size={22} weight="bold" className="agent-spin" /> : <Camera size={22} weight="regular" />}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{busy ? "Uploading…" : "Add photo"}</span>
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

        {/* Tenure + purchase type */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {TENURES.map((t) => (
            <Choice key={t.value} selected={fields.tenure === t.value} onClick={() => onUpdate({ tenure: t.value })}>{t.label}</Choice>
          ))}
          <span style={{ width: 1, height: 18, background: "var(--nv2-border-dark)" }} />
          {PURCHASE_TYPES.map((p) => (
            <Choice key={p.value} selected={fields.purchaseType === p.value} onClick={() => onUpdate({ purchaseType: p.value })}>{p.label}</Choice>
          ))}
        </div>

        {/* Progressed by */}
        {canOutsource && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginRight: 2 }}>Progressed by</span>
            <Choice selected={fields.progressedBy === "agent"} onClick={() => onUpdate({ progressedBy: "agent" })}>Self-progress</Choice>
            <Choice selected={fields.progressedBy === "progressor"} onClick={() => onUpdate({ progressedBy: "progressor" })}>Send to us</Choice>
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
