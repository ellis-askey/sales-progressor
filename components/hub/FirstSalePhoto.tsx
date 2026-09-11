"use client";

// Photo slot for the first-sale hero card. Shows the claimed sale's photo, or
// the coral house-sketch fallback when there's none. Hovering reveals a camera
// badge (same idea as the profile-photo upload); clicking uploads a real photo
// via the existing property-photo flow (usePropertyPhoto), which becomes the
// file's picture.

import { Camera, CircleNotch } from "@phosphor-icons/react";
import { usePropertyPhoto } from "@/components/transaction/HeroPhotoUpload";

export function FirstSalePhoto({
  transactionId,
  photoUrl,
}: {
  transactionId: string;
  photoUrl: string | null;
}) {
  const photo = usePropertyPhoto(transactionId, photoUrl);

  return (
    <button
      type="button"
      onClick={photo.triggerUpload}
      disabled={photo.busy}
      data-busy={photo.busy ? "" : undefined}
      className="fsh-photo"
      aria-label={photo.hasPhoto ? "Change property photo" : "Add a property photo"}
      title={photo.hasPhoto ? "Change photo" : "Add a photo"}
    >
      {photo.displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.displayUrl} alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <span className="property-photo-fallback" aria-hidden style={{ display: "block", width: "100%", height: "100%" }} />
      )}
      <span className="fsh-photo-cam" aria-hidden>
        <span className="fsh-photo-cam-badge">
          {photo.busy ? <CircleNotch size={18} weight="bold" className="agent-spin" /> : <Camera size={18} weight="fill" />}
        </span>
      </span>
      <input ref={photo.inputRef} type="file" accept="image/*" onChange={photo.onFile} style={{ display: "none" }} />
    </button>
  );
}
