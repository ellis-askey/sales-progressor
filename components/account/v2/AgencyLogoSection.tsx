"use client";

// Director-only: upload the agency's logo, shown in client emails. The preview
// renders the logo exactly as it appears in email — inside a fixed white chip —
// so a transparent PNG and a dark square both look intentional. Falls back to
// the agency's name (text) in emails when no logo is set.

import { useState, useRef } from "react";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif";
const ALLOWED = new Set(ACCEPT.split(","));

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AgencyLogoSection({ initialLogoUrl }: { initialLogoUrl: string | null }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = preview ?? logoUrl;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    if (!ALLOWED.has(file.type)) { setError("Please choose a PNG, JPG, WebP or SVG."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Logo must be under 2MB."); return; }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setBusy(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch("/api/agent/agency-logo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataBase64, mimetype: file.type }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Upload failed. Try again."); setPreview(null); return; }
      setLogoUrl(`${json.url}?t=${Date.now()}`);
      setPreview(null);
    } catch {
      setError("Upload failed. Try again.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/agent/agency-logo", { method: "DELETE" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Couldn't remove the logo."); return; }
      setLogoUrl(null); setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Preview chip — exactly how it renders in emails */}
      <div
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "#fff", border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12,
          padding: "14px 20px", height: 76, width: 280, boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Agency logo" style={{ maxHeight: 44, maxWidth: 240, objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>No logo yet</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{
            fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.14)", background: "#fff", color: "#111827",
            cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Uploading…" : shown ? "Replace logo" : "Upload logo"}
        </button>
        {logoUrl && !busy && (
          <button
            type="button"
            onClick={onRemove}
            style={{ fontSize: 13, fontWeight: 500, background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0 }}
          >
            Remove
          </button>
        )}
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={onFile} style={{ display: "none" }} />
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
        A PNG with a transparent background looks best. If you don&apos;t add a logo, your emails show your agency name instead.
      </p>
      {error && <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>{error}</p>}
    </div>
  );
}
