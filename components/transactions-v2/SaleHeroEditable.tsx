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
import dynamic from "next/dynamic";
import { PencilSimple, CheckCircle, Trash, Camera, Check, MapPin } from "@/components/icons/ph";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { PriceField } from "@/components/ui/PriceField";
import { AddPhotoCircle } from "@/components/transaction/HeroPhotoUpload";

// Postcode → mini location map, the same visual the property-file hero shows
// before a photo is added. Client-only; a single instance so maplibre can't clash.
const PropertyLocationMap = dynamic(() => import("@/components/transaction/PropertyLocationMap"), { ssr: false });
// A trailing/standalone UK postcode — only then can we place the map.
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
import { AddressFields } from "@/components/transactions-v2/form/AddressFields";
import { Button } from "@/components/arc/button/button";
import { EditConfirmActions } from "@/components/ui/EditConfirmActions";
import "@/components/arc/cookie-consent/scope.css";
import { prepareImageForUpload, describeUploadError, SAFE_UPLOAD_BYTES } from "@/lib/images/prepare-upload";
import { useCardSurface } from "@/lib/glass/use-card-surface";
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

// A selectable pill chip. Unselected is a clean outline (no fill) that turns
// the brand colour on hover; selected fills with the brand gradient + gloss —
// the option-select treatment used on the claim-flow choice cards. Everything
// derives from --agent-coral*, so it follows the agency's chosen colour.
// Filter-chip treatment (matches the Liquid Glass GlassChip): solid coral + an
// animated check tick when selected, a clean outline that warms to coral on
// hover otherwise. Rendered with agent tokens so it lives natively in the hero.
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center",
        fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
        padding: "6px 15px", borderRadius: 999, cursor: "pointer",
        border: selected ? "1.5px solid transparent" : `1.5px solid ${hover ? "var(--agent-coral)" : "var(--agent-border-default)"}`,
        background: selected ? "var(--agent-coral-deep)" : "transparent",
        color: selected ? "var(--agent-text-on-coral)" : hover ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)",
        boxShadow: "none",
        transition: "background 160ms, border-color 150ms, color 150ms",
      }}
    >
      <span aria-hidden style={{
        display: "inline-flex", alignItems: "center", overflow: "hidden",
        width: selected ? 17 : 0, opacity: selected ? 1 : 0,
        transition: "width 200ms cubic-bezier(0.16,1,0.3,1), opacity 150ms ease",
      }}>
        <Check size={13} weight="bold" />
      </span>
      {children}
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
  showMemoFooter = false, onChangeFile, progressorName = null, hasExternalProgressor = false,
}: {
  fields: FormFields;
  onUpdate: (u: Partial<FormFields>) => void;
  currentDraftId: string | null;
  ensureDraft: () => Promise<string | null>;
  canOutsource?: boolean;
  showMemoFooter?: boolean;
  onChangeFile?: () => void;
  // When set, this agency was invited by a progression business.
  progressorName?: string | null;
  // The agency works with an external progressor (one or more). The outsource
  // choice then reads "Outsource" rather than "Send to us" (which implies TSP).
  hasExternalProgressor?: boolean;
}) {
  const { toast } = useAgentToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState<boolean>(!!fields.photoStoragePath);
  const [busy, setBusy] = useState(false);

  const addressLine = [fields.streetAddress, fields.city, fields.postcode].map((s) => s.trim()).filter(Boolean).join(", ");
  const [editingAddress, setEditingAddress] = useState<boolean>(!addressLine);
  // Snapshot the address when the editor opens, so the cancel (X) can revert to it.
  // Editing writes live via onUpdate, so without this there's nothing to roll back to.
  const addressSnapshot = useRef<{ streetAddress: string; city: string; postcode: string } | null>(null);
  const openAddressEditor = () => {
    addressSnapshot.current = { streetAddress: fields.streetAddress, city: fields.city, postcode: fields.postcode };
    setEditingAddress(true);
  };
  const cancelAddressEdit = () => {
    if (addressSnapshot.current) onUpdate(addressSnapshot.current);
    setEditingAddress(false);
  };
  // Split like the property-file hero: street on top, town + postcode below.
  const [line1, ...restAddr] = addressLine.split(",");
  const line2 = restAddr.join(",").trim();

  // Once there's a valid postcode (MOS parsed or typed in), the neutral photo
  // zone becomes the postcode map with an overlaid "Add photo" pill — exactly the
  // property-file hero's no-photo treatment. Before that, the branded circle.
  const mapPostcode = POSTCODE_RE.test((fields.postcode ?? "").trim()) ? fields.postcode!.trim() : null;
  const showMap = !hasPhoto && !!mapPostcode;


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

  const { surfaceClass, tag } = useCardSurface("new-sale-hero", "New sale · Sale hero", "agent-glass-strong");

  return (
    <div className={surfaceClass} {...tag} style={{ position: "relative", overflow: "hidden", borderRadius: "var(--agent-radius-xl)", display: "flex", flexWrap: "wrap", animation: "agent-section-in 320ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) both" }}>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

      {/* Photo zone — exact property-file treatment: narrow zone widens on upload,
          image revealed left-to-right behind a right-edge mask, circle fades out. */}
      <div style={{
        position: "relative", flexGrow: 0, flexShrink: 1,
        flexBasis: (hasPhoto || showMap) ? 380 : 168, minWidth: (hasPhoto || showMap) ? 240 : 168,
        alignSelf: "stretch", overflow: "hidden",
        transition: `flex-basis 560ms ${EASE}, min-width 560ms ${EASE}`,
      }}>
        {/* Postcode map backdrop — fades in when a valid postcode lands and there's
            no photo yet; the photo (if added) sits on top and the map unmounts. */}
        {showMap && (
          <div key={mapPostcode} style={{
            position: "absolute", inset: 0, animation: `agent-overlay-fade-in 420ms ${EASE} both`,
            // Same right-edge fade the photo uses, so the map melts into the card
            // rather than ending on a blunt vertical cut.
            maskImage: "linear-gradient(to right, #000 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, #000 55%, transparent 100%)",
          }}>
            <PropertyLocationMap postcode={mapPostcode!} />
          </div>
        )}
        {displayUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt="" style={{
            position: "absolute", left: 0, top: 0, height: "100%", width: 380, maxWidth: "none",
            objectFit: "cover", opacity: hasPhoto ? 1 : 0, zIndex: 1,
            maskImage: "linear-gradient(to right, #000 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, #000 55%, transparent 100%)",
            transition: `opacity 560ms ${EASE}`, pointerEvents: "none",
          }} />
        )}
        {/* Branded circle — only before there's a photo OR a placeable postcode. */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: (hasPhoto || showMap) ? 0 : 1, pointerEvents: (hasPhoto || showMap) ? "none" : "auto", transition: "opacity 300ms ease" }}>
          <AddPhotoCircle onClick={() => { if (!busy) inputRef.current?.click(); }} busy={busy} size={120} />
        </div>
        {/* "Memo read" status — top-left, same dark glass as the file's Back button. */}
        {showMemoFooter && (
          <span style={{ ...DARK_PILL, top: 14, left: 14 }}>
            <CheckCircle size={13} weight="fill" />
            Memo read
          </span>
        )}
        {/* Add-photo pill over the map — the same control the property-file hero
            shows on its no-photo map. */}
        {showMap && (
          <button
            type="button"
            onClick={() => { if (!busy) inputRef.current?.click(); }}
            disabled={busy}
            style={{ ...DARK_PILL, bottom: 14, left: 14, cursor: busy ? "wait" : "pointer" }}
          >
            <Camera size={13} weight="regular" />
            {busy ? "Uploading…" : "Add photo"}
          </button>
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
                onClick={openAddressEditor}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAddressEditor(); } }}
                className="hero-address-edit"
                aria-label="Edit address"
                style={{ minWidth: 0 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {/* Location pin — shown only once an address is entered, in the map's
                      own --agent-info blue so the pin and the map agree. */}
                  {addressLine && (
                    <MapPin size={42} weight="fill" color="var(--agent-info, #3D7AB8)" aria-hidden style={{ flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
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
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateRows: editingAddress ? "1fr" : "0fr", transition: "grid-template-rows 300ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1))" }}>
            <div style={{ overflow: "hidden", minHeight: 0 }}>
              {/* The collapsed address line sizes this column to ~190px; editing
                  needs room for two canonical fields side by side, so the editor
                  claims a working width (wraps under the price on narrow heroes). */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 2, minWidth: "min(390px, 100%)", width: 390, maxWidth: "100%" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <AddressFields
                    solid
                    streetAddress={fields.streetAddress}
                    city={fields.city}
                    postcode={fields.postcode}
                    onStreetAddressChange={(v) => onUpdate({ streetAddress: v })}
                    onCityChange={(v) => onUpdate({ city: v })}
                    onPostcodeChange={(v) => onUpdate({ postcode: v })}
                  />
                </div>
                {/* Confirm / cancel sit to the RIGHT of the fields, vertically centred.
                    Gated on editingAddress so they re-mount — and re-run their spring-in /
                    tick-draw — every time the editor opens (not just once on page mount). */}
                {addressLine && editingAddress && (
                  <EditConfirmActions
                    startDelay={0.33}
                    confirmLabel="Done editing address"
                    cancelLabel="Cancel address edit"
                    onConfirm={() => setEditingAddress(false)}
                    onCancel={cancelAddressEdit}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Price — a simple £ pill you click and type into (shows just "£" when
            empty, "£230,000" once typed). No placeholder text, no save. */}
        <div style={{ flexShrink: 0 }}>
          <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)" }}>Sale price</p>
          <div style={{ width: 190 }}>
            <PriceField accent value={fields.purchasePricePence} onChange={(v) => onUpdate({ purchasePricePence: v })} label="Sale price" hideLabel height={46} fontSize={22} />
          </div>
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
            <Choice selected={fields.progressedBy === "progressor"} onClick={() => onUpdate({ progressedBy: "progressor" })}>{hasExternalProgressor ? "Outsource" : progressorName ? `Send to ${progressorName}` : "Send to us"}</Choice>
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
