"use client";

// Uploadable variant of the shared PropertyThumb, for hub rows where adding
// the file's photo in place makes sense (today: the Needs-assigning row).
// Hovering blurs the current picture (or the line-art fallback) and reveals
// the camera badge — same affordance as FirstSalePhoto / the profile-photo
// upload — and clicking uploads through the proven property-photo flow
// (usePropertyPhoto: browser-side downscale, clean errors, server action
// revalidates). Domain-specific (hub) rather than a ui/ primitive because it
// composes the transaction-domain upload hook; the passive thumb stays
// components/ui/PropertyThumb.
import { Camera, CircleNotch } from "@phosphor-icons/react";
import { usePropertyPhoto } from "@/components/transaction/HeroPhotoUpload";

export function UploadablePropertyThumb({
  transactionId,
  photoUrl,
  size = 44,
}: {
  transactionId: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const photo = usePropertyPhoto(transactionId, photoUrl ?? null);
  const radius = Math.max(6, Math.round(size * 0.22));
  const media: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    border: "0.5px solid rgba(15,23,42,0.08)",
  };

  return (
    <button
      type="button"
      className="hub-thumb-up"
      onClick={photo.triggerUpload}
      disabled={photo.busy}
      data-busy={photo.busy ? "" : undefined}
      aria-label={photo.hasPhoto ? "Change property photo" : "Add a property photo"}
      title={photo.hasPhoto ? "Change photo" : "Add a photo"}
      style={{ borderRadius: radius }}
    >
      {photo.displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.displayUrl} alt="" aria-hidden className="hub-thumb-up-media" style={{ ...media, objectFit: "cover", display: "block" }} />
      ) : (
        <span aria-hidden className="property-photo-fallback hub-thumb-up-media" style={{ ...media, display: "block" }} />
      )}
      <span className="hub-thumb-up-cam" aria-hidden style={{ borderRadius: radius }}>
        {photo.busy
          ? <CircleNotch size={Math.round(size * 0.42)} weight="bold" className="agent-spin" />
          : <Camera size={Math.round(size * 0.42)} weight="fill" />}
      </span>
      <input ref={photo.inputRef} type="file" accept="image/*" onChange={photo.onFile} style={{ display: "none" }} />
    </button>
  );
}
