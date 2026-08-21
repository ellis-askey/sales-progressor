"use client";

// Large circular property-photo control for the file hero (2026-08-21).
// Replaces the old full-bleed photo square + house glyph. A hollow circle
// with a camera icon when empty; the photo (cover) inside a white ring when
// set. The whole circle is clickable to upload/replace; "Remove photo" sits
// beneath. Same upload/remove flow as the old contacts-card field (which this
// supersedes) — browser-side downscale + clean errors.

import { useRef, useState } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { setPropertyPhotoAction, removePropertyPhotoAction } from "@/app/actions/property-extras";
import { prepareImageForUpload, describeUploadError, SAFE_UPLOAD_BYTES } from "@/lib/images/prepare-upload";
import { Camera } from "@phosphor-icons/react";

export function HeroPhotoUpload({
  transactionId,
  initialUrl,
  size = 120,
}: {
  transactionId: string;
  initialUrl: string | null;
  size?: number;
}) {
  const { toast } = useAgentToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
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
      await setPropertyPhotoAction(transactionId, json.storagePath);
      setPreviewUrl(json.url);
      toast.success("Photo uploaded");
    } catch {
      toast.error("We couldn't upload that photo. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await removePropertyPhotoAction(transactionId);
      setPreviewUrl(null);
      toast.success("Photo removed");
    } catch {
      toast.error("We couldn't remove that photo. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={previewUrl ? "Replace property photo" : "Add a property photo"}
        title={previewUrl ? "Replace photo" : "Add a photo"}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: uploading ? "wait" : "pointer",
          overflow: "hidden",
          padding: 0,
          fontFamily: "inherit",
          // Photo: white ring + soft shadow (matches the broker/progressor
          // avatars). Empty: hollow dashed circle inviting an upload.
          background: previewUrl ? "#fff" : "var(--agent-surface-elevated)",
          border: previewUrl ? "4px solid #fff" : "2px dashed var(--agent-border-strong, rgba(15,23,42,0.18))",
          boxShadow: previewUrl ? "0 2px 10px rgba(15,23,42,0.14)" : "none",
          color: "var(--agent-text-muted)",
        }}
        className="agent-hover-row"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Property" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <Camera size={size * 0.26} weight="regular" />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{uploading ? "Uploading…" : "Add photo"}</span>
          </span>
        )}
      </button>
      {previewUrl && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--agent-text-muted)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {removing ? "Removing…" : "Remove photo"}
        </button>
      )}
    </div>
  );
}
