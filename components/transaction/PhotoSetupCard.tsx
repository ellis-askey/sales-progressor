"use client";

// Inline camera card for the File setup tab — add or change the property photo
// in place, no drawer. Reuses the proven usePropertyPhoto controller (browser
// downscale, upload, persist) and the AddPhotoCircle affordance from the hero.

import { usePropertyPhoto, AddPhotoCircle } from "@/components/transaction/HeroPhotoUpload";

export function PhotoSetupCard({
  transactionId,
  photoUrl,
}: {
  transactionId: string;
  photoUrl: string | null;
}) {
  const photo = usePropertyPhoto(transactionId, photoUrl);

  return (
    <div className="flex items-center gap-4">
      {/* hidden file input the controller drives */}
      <input ref={photo.inputRef} type="file" accept="image/*" onChange={photo.onFile} hidden />

      {photo.hasPhoto && photo.displayUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.displayUrl}
            alt="Property"
            className="w-24 h-24 rounded-xl object-cover shrink-0 border border-black/10"
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={photo.triggerUpload}
              disabled={photo.busy}
              className="text-[13px] font-semibold text-[var(--agent-coral-deep)] hover:underline disabled:opacity-60 text-left"
            >
              {photo.busy ? "Uploading…" : "Change photo"}
            </button>
            <button
              type="button"
              onClick={photo.remove}
              disabled={photo.busy}
              className="text-[12.5px] text-slate-900/55 hover:text-slate-900/80 disabled:opacity-60 text-left"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <AddPhotoCircle onClick={photo.triggerUpload} busy={photo.busy} size={96} />
          <p className="text-[13px] text-slate-900/55 max-w-[240px]">
            Add a photo to make this file easy to recognise.
          </p>
        </>
      )}
    </div>
  );
}
