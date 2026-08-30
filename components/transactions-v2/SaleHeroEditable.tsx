"use client";

// The editable "file hero" on the New Sale form. Mirrors the property-file hero
// look (photo left fading into the card, content right) but its fields are bound
// to the new-sale form state, so the sale fills in live as the agent works and
// they can set the photo, price, tenure and purchase type right here. Replaces
// the old Stage-1 summary bar + the right-column read-only File Preview.
//
// The photo uses the real upload flow. Since there's no file yet, it uploads
// against an on-demand draft (ensureDraft) and stashes the storage path in the
// form; the path is carried onto the new file on submit (see FormFields +
// createTransaction). See components/transaction/HeroPhotoUpload.tsx for the
// file-page equivalent.

import { useRef, useState } from "react";
import { HouseSimple, Camera, PencilSimple, X } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { PriceInput } from "@/components/ui/PriceInput";
import { Pill } from "@/components/ui/Pill";
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

// A small pill-shaped selectable chip (glass when selected).
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
  fields, onUpdate, onEditAddress, currentDraftId, ensureDraft,
}: {
  fields: FormFields;
  onUpdate: (u: Partial<FormFields>) => void;
  onEditAddress: () => void;
  currentDraftId: string | null;
  ensureDraft: () => Promise<string | null>;
}) {
  const { toast } = useAgentToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState<boolean>(!!fields.photoStoragePath);
  const [busy, setBusy] = useState(false);

  const addressLine = [fields.streetAddress, fields.city, fields.postcode].map((s) => s.trim()).filter(Boolean).join(", ");

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
    <div className="agent-glass-strong" style={{ position: "relative", overflow: "hidden", borderRadius: "var(--agent-radius-xl)", display: "flex", flexWrap: "wrap" }}>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

      {/* Photo zone */}
      <div style={{ position: "relative", flex: "0 0 auto", width: 180, minHeight: 168, background: hasPhoto ? "transparent" : "linear-gradient(135deg, rgba(var(--agent-coral-rgb),0.16), rgba(var(--agent-coral-rgb),0.05))", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
            <span style={{ width: 46, height: 46, borderRadius: "50%", border: "2px dashed rgba(var(--agent-coral-rgb),0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {busy ? <HouseSimple size={20} weight="regular" /> : <Camera size={20} weight="regular" />}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{busy ? "Uploading…" : "Add photo"}</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: "1 1 320px", minWidth: 0, padding: "18px 20px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Address */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {addressLine ? (
              <p style={{ margin: 0, fontSize: "var(--agent-text-h2, 22px)", fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.2 }}>{addressLine}</p>
            ) : (
              <button type="button" onClick={onEditAddress} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "var(--agent-text-h2, 22px)", fontWeight: 700, color: "var(--agent-text-muted)", letterSpacing: "var(--agent-tracking-tight)" }}>Add the address</button>
            )}
          </div>
          {addressLine && (
            <button type="button" onClick={onEditAddress} aria-label="Edit address" style={{ flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer", color: "var(--agent-text-muted)" }}>
              <PencilSimple size={15} weight="regular" />
            </button>
          )}
        </div>

        {/* Price */}
        <div>
          <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 700, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Sale price</p>
          <PriceInput value={fields.purchasePricePence} onChange={(v) => onUpdate({ purchasePricePence: v })} placeholder="Add the sale price" className="price-hero-input" />
        </div>

        {/* Tenure + purchase type */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TENURES.map((t) => (
            <Choice key={t.value} selected={fields.tenure === t.value} onClick={() => onUpdate({ tenure: t.value })}>{t.label}</Choice>
          ))}
          <span style={{ width: 1, alignSelf: "stretch", background: "var(--nv2-border-dark)" }} />
          {PURCHASE_TYPES.map((p) => (
            <Choice key={p.value} selected={fields.purchaseType === p.value} onClick={() => onUpdate({ purchaseType: p.value })}>{p.label}</Choice>
          ))}
        </div>
      </div>
    </div>
  );
}
