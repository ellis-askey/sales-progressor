"use client";
// components/contacts/PropertyPhotoField.tsx
//
// Compact photo upload + preview + remove control for the agent side.
// Sits on the transaction detail page. On the client portal the photo
// renders separately as a hero — this component is agent-only.
//
// States:
//   - No photo: shows a small "+ Add photo" dashed-border tile
//   - Uploading: dashed border, "Uploading…" text
//   - Photo present: 96×96 thumbnail with a small remove-icon overlay
//
// Upload flow: POST /api/agent/upload-property-photo → setPropertyPhotoAction.
// Removal: removePropertyPhotoAction (which also purges the file from Supabase).

import { useRef, useState } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { setPropertyPhotoAction, removePropertyPhotoAction } from "@/app/actions/property-extras";
import { Camera, X } from "@phosphor-icons/react";

export function PropertyPhotoField({
  transactionId,
  initialUrl,
}: {
  transactionId: string;
  // Signed URL for the current photo, minted server-side by the page.
  // Null when no photo is set.
  initialUrl: string | null;
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
      const form = new FormData();
      form.append("transactionId", transactionId);
      form.append("file", file);
      const res = await fetch("/api/agent/upload-property-photo", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      // Persist the reference on the row.
      await setPropertyPhotoAction(transactionId, json.storagePath);
      setPreviewUrl(json.url);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      {previewUrl ? (
        <div
          style={{
            position: "relative",
            width: 72, height: 72,
            borderRadius: 10,
            overflow: "hidden",
            border: "0.5px solid var(--agent-border-default)",
            background: "var(--agent-surface-elevated)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Property"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            title="Remove photo"
            aria-label="Remove photo"
            style={{
              position: "absolute", top: 4, right: 4,
              width: 20, height: 20, borderRadius: 6,
              background: "rgba(15,23,42,0.72)", color: "white",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "none", cursor: "pointer",
            }}
          >
            <X size={11} weight="bold" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            display: "inline-flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 3,
            width: 72, height: 72, borderRadius: 10,
            border: "1px dashed var(--agent-border-default)",
            background: "var(--agent-surface-elevated)",
            color: "var(--agent-text-muted)",
            cursor: uploading ? "wait" : "pointer",
            fontSize: 10, fontWeight: 500,
          }}
        >
          <Camera size={16} weight="regular" />
          {uploading ? "Uploading…" : "+ Photo"}
        </button>
      )}
      {previewUrl && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="agent-link"
          style={{ fontSize: 12 }}
        >
          Replace
        </button>
      )}
    </div>
  );
}
