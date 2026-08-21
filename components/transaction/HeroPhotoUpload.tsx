"use client";

// Property-photo controller + add-circle for the file hero (2026-08-21).
//
// The hero's photo has an animated empty <-> photo transition: uploading
// widens the left zone (content slides right), the photo fades in left-to
// -right as the zone reveals it, the add circle fades out, and the Remove pill
// fades in bottom-left; removing runs the exact reverse. Because that motion
// spans three separate spots in the hero (desktop zone, mobile layer, remove
// pill) the shared state lives in `usePropertyPhoto` and each spot renders off
// `hasPhoto` with CSS transitions. The upload/remove is the proven flow:
// browser-side downscale, clean errors, server action revalidates to persist.

import { useRef, useState } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { setPropertyPhotoAction, removePropertyPhotoAction } from "@/app/actions/property-extras";
import { prepareImageForUpload, describeUploadError, SAFE_UPLOAD_BYTES } from "@/lib/images/prepare-upload";
import { Camera } from "@phosphor-icons/react";

// Must exceed the out-animation duration so the photo finishes wiping out
// before its <img> is unmounted.
const CLEAR_AFTER_MS = 640;

export type PropertyPhotoController = {
  inputRef: React.RefObject<HTMLInputElement>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  triggerUpload: () => void;
  remove: () => void;
  displayUrl: string | null;
  hasPhoto: boolean;
  busy: boolean;
};

export function usePropertyPhoto(transactionId: string, initialUrl: string | null): PropertyPhotoController {
  const { toast } = useAgentToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(initialUrl);
  const [hasPhoto, setHasPhoto] = useState<boolean>(!!initialUrl);
  const [busy, setBusy] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (clearTimer.current) { clearTimeout(clearTimer.current); clearTimer.current = null; }
    setBusy(true);
    try {
      const { file: prepared, reencoded } = await prepareImageForUpload(file);
      if (!reencoded && prepared.size > SAFE_UPLOAD_BYTES) {
        toast.error("That image is too large to upload. Please use one under 4 MB, or a JPG or PNG.");
        return;
      }
      const form = new FormData();
      form.append("transactionId", transactionId);
      form.append("file", prepared);
      const res = await fetch("/api/agent/upload-property-photo", { method: "POST", body: form });
      if (!res.ok) {
        toast.error(await describeUploadError(res));
        return;
      }
      const json = await res.json();
      // Paint the photo at opacity 0 (zone still narrow) first, then flip
      // hasPhoto on a later frame so the browser animates the transition in
      // rather than jumping straight to the end state.
      setDisplayUrl(json.url);
      requestAnimationFrame(() => requestAnimationFrame(() => setHasPhoto(true)));
      await setPropertyPhotoAction(transactionId, json.storagePath);
      toast.success("Photo uploaded");
    } catch {
      toast.error("We couldn't upload that photo. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function triggerUpload() {
    if (!busy) inputRef.current?.click();
  }

  function remove() {
    if (busy) return;
    const previous = displayUrl;
    setBusy(true);
    setHasPhoto(false); // runs the out-animation
    clearTimer.current = setTimeout(() => setDisplayUrl(null), CLEAR_AFTER_MS);
    removePropertyPhotoAction(transactionId)
      .then(() => toast.success("Photo removed"))
      .catch(() => {
        if (clearTimer.current) { clearTimeout(clearTimer.current); clearTimer.current = null; }
        setDisplayUrl(previous);
        setHasPhoto(true);
        toast.error("We couldn't remove that photo. Please try again.");
      })
      .finally(() => setBusy(false));
  }

  return { inputRef, onFile, triggerUpload, remove, displayUrl, hasPhoto, busy };
}

// The hollow add-photo circle shown in the empty state.
export function AddPhotoCircle({
  onClick,
  busy,
  size = 120,
}: {
  onClick: () => void;
  busy: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Add a property photo"
      title="Add a photo"
      className="agent-hover-row"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: busy ? "wait" : "pointer",
        padding: 0,
        fontFamily: "inherit",
        background: "var(--agent-surface-elevated)",
        border: "2px dashed var(--agent-border-strong, rgba(15,23,42,0.18))",
        color: "var(--agent-text-muted)",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <Camera size={size * 0.26} weight="regular" />
        <span style={{ fontSize: 11, fontWeight: 600 }}>{busy ? "Uploading…" : "Add photo"}</span>
      </span>
    </button>
  );
}
