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
import { PencilSimple, CheckCircle, Trash } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { PriceInput } from "@/components/ui/PriceInput";
import { Pill } from "@/components/ui/Pill";
import { AddPhotoCircle } from "@/components/transaction/HeroPhotoUpload";
import { AddressFields } from "@/components/transactions-v2/form/AddressFields";
import { prepareImageForUpload, describeUploadError, SAFE_UPLOAD_BYTES } from "@/lib/images/prepare-upload";
import type { FormFields } from "@/components/transactions-v2/form/types";

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

// The dark frosted-glass pill used for the photo overlays (matches the
// property-file "Back to files" / "Remove photo" buttons).
const DARK_PILL: React.CSSProperties = {
  position: "absolute", zIndex: 2, display: "inline-flex", alignItems: "center", gap: 6,
  fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, border: "none",
  color: "#fff", background: "rgba(15,23,42,0.42)",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", fontFamily: "inherit",
};

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

// Group label — green once a selection is made, grey while it isn't.
function GroupLabel({ children, selected }: { children: React.ReactNode; selected: boolean }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: selected ? "var(--agent-success)" : "var(--agent-text-muted)", transition: "color 150ms" }}>
      {children}
    </span>
  );
}

export function SaleHeroEditable({
  fields, onUpdate, currentDraftId, ensureDraft, canOutsource = true,
  showMemoFooter = false, onChangeFile,
}: {
  fields: FormFields;
  onUpdate: (u: Partial<FormFields>) => void;
  currentDraftId: string | null;
  ensureDraft: () => Promise<string | null>;
  canOutsource?: boolean;
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
  // Split like the property-file hero: street on top, town + postcode below.
  const [line1, ...restAddr] = addressLine.split(",");
  const line2 = restAddr.join(",").trim();


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
        {/* "Memo read" status — top-left, same dark glass as the file's Back button. */}
        {showMemoFooter && (
          <span style={{ ...DARK_PILL, top: 14, left: 14 }}>
            <CheckCircle size={13} weight="fill" />
            Memo read
          </span>
        )}
        {/* Remove-photo — bottom-left, same dark glass, fades with the photo. */}
        <button
          type="button"
          onClick={removePhoto}
          disabled={busy || !hasPhoto}
          aria-hidden={!hasPhoto}
          style={{ ...DARK_PILL, bottom: 14, left: 14, cursor: busy ? "wait" : "pointer", opacity: hasPhoto ? 1 : 0, pointerEvents: hasPhoto ? "auto" : "none", transition: hasPhoto ? "opacity 360ms ease 240ms" : "opacity 220ms ease" }}
        >
          <Trash size={13} weight="regular" />
          Remove photo
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: "1 1 340px", minWidth: 0, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Address (left) + sale price (a comfortable gap to its right); the
            price wraps below the address when the row runs out of width. */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "12px 64px" }}>
        {/* Address — display and editor crossfade their heights (grid-rows
            0fr↔1fr) so the hero, and the photo that stretches to match it, grow
            and shrink smoothly instead of jumping. */}
        <div style={{ flex: "0 1 auto", minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateRows: editingAddress ? "0fr" : "1fr", transition: "grid-template-rows 300ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1))" }}>
            <div style={{ overflow: "hidden", minHeight: 0 }}>
              {/* The address itself opens the editor on click; the pencil sits
                  right beside line 1 and only appears on hover/focus. */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setEditingAddress(true)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditingAddress(true); } }}
                className="hero-address-edit"
                aria-label="Edit address"
                style={{ minWidth: 0 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "var(--agent-text-h2, 22px)", fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{line1}</p>
                  <span className="hero-edit-pencil" aria-hidden style={{ flexShrink: 0, display: "inline-flex", color: "var(--agent-text-muted)" }}>
                    <PencilSimple size={15} weight="regular" />
                  </span>
                </div>
                {line2 && <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--agent-text-muted)", lineHeight: 1.35 }}>{line2}</p>}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateRows: editingAddress ? "1fr" : "0fr", transition: "grid-template-rows 300ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1))" }}>
            <div style={{ overflow: "hidden", minHeight: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
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
            </div>
          </div>
        </div>

        {/* Price — a simple £ pill you click and type into (shows just "£" when
            empty, "£230,000" once typed). No placeholder text, no save. */}
        <div style={{ flexShrink: 0 }}>
          <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 700, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Sale price</p>
          <PriceInput value={fields.purchasePricePence} onChange={(v) => onUpdate({ purchasePricePence: v })} placeholder="" className="sale-price-pill" />
        </div>
        </div>{/* end address + price row */}

        {/* Tenure */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <GroupLabel selected={!!fields.tenure}>Tenure</GroupLabel>
          {TENURES.map((t) => (
            <Choice key={t.value} selected={fields.tenure === t.value} onClick={() => onUpdate({ tenure: t.value })}>{t.label}</Choice>
          ))}
        </div>

        {/* Purchase type */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <GroupLabel selected={!!fields.purchaseType}>Purchase type</GroupLabel>
          {PURCHASE_TYPES.map((p) => (
            <Choice key={p.value} selected={fields.purchaseType === p.value} onClick={() => onUpdate({ purchaseType: p.value })}>{p.label}</Choice>
          ))}
        </div>

        {/* Progressed by */}
        {canOutsource && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <GroupLabel selected={!!fields.progressedBy}>Progressed by</GroupLabel>
            <Choice selected={fields.progressedBy === "agent"} onClick={() => onUpdate({ progressedBy: "agent" })}>Self-progress</Choice>
            <Choice selected={fields.progressedBy === "progressor"} onClick={() => onUpdate({ progressedBy: "progressor" })}>Send to us</Choice>
          </div>
        )}

        {/* Change file — subtle link in memo mode (the "Memo read" status is the
            top-left pill; the "still needed" list is gone). */}
        {showMemoFooter && onChangeFile && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={onChangeFile} className="agent-link agent-link-muted" style={{ fontSize: 12 }}>
              Change file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
