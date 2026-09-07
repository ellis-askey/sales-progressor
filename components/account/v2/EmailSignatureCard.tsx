"use client";

// Profile → "Email signature" card. Three options, all resolving through the one
// signature resolver so the preview matches what recipients receive:
//   BASIC  — auto-generated from profile details (default)
//   IMAGE  — an uploaded, or imported-from-URL, signature image
//   CUSTOM — a pasted signature (sanitised server-side)
//
// See docs/active/email-signature/00-audit-and-plan.md.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailSignatureMode } from "@prisma/client";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { saveSignatureAction, previewSignatureAction } from "@/app/actions/signature";
import { PenNib, UploadSimple, Link as LinkIcon, Trash } from "@phosphor-icons/react";

export interface SignatureInitial {
  mode: EmailSignatureMode;
  imageUrl: string | null;
  customHtml: string | null;
  previewHtml: string;
  missing: string[];
}

const MODES: Array<{ value: EmailSignatureMode; label: string; blurb: string }> = [
  { value: "BASIC", label: "Basic", blurb: "Created automatically from your details." },
  { value: "IMAGE", label: "Signature image", blurb: "Use an image of your existing signature." },
  { value: "CUSTOM", label: "Custom", blurb: "Paste the signature you already use." },
];

export function EmailSignatureCard({ initial }: { initial: SignatureInitial }) {
  const router = useRouter();
  const { toast } = useAgentToast();

  const [mode, setMode] = useState<EmailSignatureMode>(initial.mode);
  const [imageUrl, setImageUrl] = useState<string | null>(initial.imageUrl);
  const [customHtml, setCustomHtml] = useState<string | null>(initial.customHtml);
  const [previewHtml, setPreviewHtml] = useState<string>(initial.previewHtml);
  const [missing, setMissing] = useState<string[]>(initial.missing);

  const [savedMode, setSavedMode] = useState<EmailSignatureMode>(initial.mode);
  const [savedCustom, setSavedCustom] = useState<string | null>(initial.customHtml);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [urlValue, setUrlValue] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    mode !== savedMode || (mode === "CUSTOM" && (customHtml ?? "") !== (savedCustom ?? ""));

  const refreshPreview = useCallback(async (m: EmailSignatureMode, html: string | null) => {
    try {
      const res = await previewSignatureAction({ mode: m, customHtml: html });
      setPreviewHtml(res.html);
      setMissing(res.missing);
    } catch {
      /* keep last good preview */
    }
  }, []);

  // Debounced preview when the pasted custom html changes.
  useEffect(() => {
    if (mode !== "CUSTOM") return;
    const t = setTimeout(() => refreshPreview("CUSTOM", customHtml), 350);
    return () => clearTimeout(t);
  }, [customHtml, mode, refreshPreview]);

  function selectMode(m: EmailSignatureMode) {
    setMode(m);
    setError("");
    setSaving("idle");
    refreshPreview(m, customHtml);
  }

  async function onSave() {
    setSaving("saving");
    setError("");
    const res = await saveSignatureAction({ mode, customHtml });
    if (!res.ok) {
      setError(res.error);
      setSaving("idle");
      return;
    }
    setSavedMode(mode);
    setSavedCustom(customHtml);
    setSaving("saved");
    toast.success("Signature saved");
    router.refresh();
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/agent/signature-image", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImageUrl(data.url);
      setMode("IMAGE");
      setSavedMode("IMAGE");
      await refreshPreview("IMAGE", customHtml);
      toast.success("Signature image saved");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that image.");
    } finally {
      setBusy(false);
    }
  }

  async function importUrl() {
    if (!urlValue.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/agent/signature-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: urlValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImageUrl(data.url);
      setMode("IMAGE");
      setSavedMode("IMAGE");
      setUrlValue("");
      await refreshPreview("IMAGE", customHtml);
      toast.success("Signature image saved");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't import that image.");
    } finally {
      setBusy(false);
    }
  }

  async function removeImage() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/agent/signature-image", { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove the image.");
      setImageUrl(null);
      setMode("BASIC");
      setSavedMode("BASIC");
      await refreshPreview("BASIC", customHtml);
      toast.success("Reverted to your basic signature");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove the image.");
    } finally {
      setBusy(false);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    const pasted = html || (text ? text.replace(/\n/g, "<br>") : "");
    if (!pasted) return;
    setCustomHtml(pasted); // raw; sanitised server-side on preview + save
  }

  function clearCustom() {
    setCustomHtml(null);
    refreshPreview("CUSTOM", null);
  }

  const saveButton = (
    <button
      type="button"
      onClick={onSave}
      disabled={!dirty || saving === "saving"}
      style={{
        fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "none",
        cursor: !dirty || saving === "saving" ? "default" : "pointer",
        background: !dirty ? "rgba(0,0,0,0.08)" : "#111827",
        color: !dirty ? "#9ca3af" : "#fff",
      }}
    >
      {saving === "saving" ? "Saving…" : saving === "saved" && !dirty ? "Saved" : "Save"}
    </button>
  );

  return (
    <AccountCard
      icon={<PenNib size={18} weight="bold" />}
      title="Email signature"
      subtitle="How your emails sign off. Applies to chases and any email you send from Sales Progressor."
      headerAction={saveButton}
    >
      {/* Mode selector */}
      <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
        {MODES.map((m) => {
          const active = mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => selectMode(m.value)}
              style={{
                textAlign: "left", cursor: "pointer", borderRadius: 10, padding: "12px 14px",
                border: active ? "2px solid #FF6B4A" : "1px solid rgba(0,0,0,0.14)",
                background: active ? "rgba(255,107,74,0.06)" : "#fff",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 16, height: 16, borderRadius: 999, flexShrink: 0,
                  border: active ? "5px solid #FF6B4A" : "2px solid rgba(0,0,0,0.3)",
                }}
              />
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#111827" }}>{m.label}</span>
                <span style={{ display: "block", fontSize: 13, color: "#6b7280" }}>{m.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Mode-specific config */}
      {mode === "BASIC" && missing.length > 0 && (
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Add your {missing.join(", ")} on this page to complete your signature.
        </p>
      )}

      {mode === "IMAGE" && (
        <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadFile(f);
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={secondaryBtn}>
              <UploadSimple size={15} weight="bold" /> {imageUrl ? "Replace image" : "Upload image"}
            </button>
            {imageUrl && (
              <button type="button" onClick={removeImage} disabled={busy} style={secondaryBtn}>
                <Trash size={15} weight="bold" /> Remove
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <LinkIcon size={15} weight="bold" style={{ color: "#6b7280", flexShrink: 0 }} />
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="…or paste an https image URL"
              style={{ flex: 1, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.14)" }}
            />
            <button type="button" onClick={importUrl} disabled={busy || !urlValue.trim()} style={secondaryBtn}>
              Import
            </button>
          </div>
        </div>
      )}

      {mode === "CUSTOM" && (
        <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
          <div
            role="textbox"
            tabIndex={0}
            onPaste={onPaste}
            style={{
              minHeight: 90, borderRadius: 10, border: "1px dashed rgba(0,0,0,0.25)",
              padding: 14, fontSize: 13, color: customHtml ? "#111827" : "#9ca3af", outline: "none",
              background: "#fff",
            }}
          >
            {customHtml ? (
              <span style={{ color: "#059669", fontWeight: 600 }}>
                Signature captured. See the preview below, then Save.
              </span>
            ) : (
              "Copy your signature from Outlook, Gmail or your signature tool, then click here and paste (Ctrl/Cmd+V)."
            )}
          </div>
          {customHtml && (
            <button type="button" onClick={clearCustom} style={{ ...secondaryBtn, width: "fit-content" }}>
              <Trash size={15} weight="bold" /> Clear
            </button>
          )}
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p>}

      {/* Live preview — exactly what recipients receive */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9ca3af", marginBottom: 8 }}>
          How your emails will sign off
        </p>
        <div
          style={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)", background: "#fff", padding: 16, overflowX: "auto" }}
          dangerouslySetInnerHTML={{ __html: previewHtml || "<span style='color:#9ca3af;font-size:13px'>Nothing to preview yet.</span>" }}
        />
      </div>
    </AccountCard>
  );
}

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600,
  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.16)",
  background: "#fff", color: "#374151", cursor: "pointer",
};
