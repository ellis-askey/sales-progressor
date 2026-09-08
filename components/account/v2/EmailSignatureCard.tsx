"use client";

// Profile → "Email signature" card. Three options, all resolving through the one
// signature resolver so the preview matches what recipients receive:
//   BASIC  — auto-generated from profile details (default)
//   IMAGE  — an uploaded, or imported-from-URL, signature image
//   CUSTOM — a pasted, editable signature (sanitised + images hosted server-side)
//
// Everything auto-saves: picking an option saves it; editing the custom
// signature saves as you go. See docs/active/email-signature/00-audit-and-plan.md.

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

type Status = "idle" | "saving" | "saved";

export function EmailSignatureCard({ initial }: { initial: SignatureInitial }) {
  const router = useRouter();
  const { toast } = useAgentToast();

  const [mode, setMode] = useState<EmailSignatureMode>(initial.mode);
  const [imageUrl, setImageUrl] = useState<string | null>(initial.imageUrl);
  const [customHtml, setCustomHtml] = useState<string | null>(initial.customHtml);
  const [previewHtml, setPreviewHtml] = useState<string>(initial.previewHtml);
  const [missing, setMissing] = useState<string[]>(initial.missing);

  const [status, setStatus] = useState<Status>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshPreview = useCallback(async (m: EmailSignatureMode, html: string | null) => {
    try {
      const res = await previewSignatureAction({ mode: m, customHtml: html });
      setPreviewHtml(res.html);
      setMissing(res.missing);
    } catch {
      /* keep last good preview */
    }
  }, []);

  async function selectMode(m: EmailSignatureMode) {
    setMode(m);
    setError("");
    setStatus("saving");
    const res = await saveSignatureAction({ mode: m, customHtml });
    setStatus(res.ok ? "saved" : "idle");
    if (!res.ok) setError(res.error);
    if (m !== "CUSTOM") await refreshPreview(m, customHtml);
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
      await refreshPreview("BASIC", customHtml);
      toast.success("Reverted to your basic signature");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove the image.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "";

  return (
    <AccountCard
      icon={<PenNib size={18} weight="bold" />}
      title="Email signature"
      subtitle="How your emails sign off. Applies to chases and any email you send from Sales Progressor."
      headerAction={
        statusLabel ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: status === "saving" ? "#9ca3af" : "#059669" }}>
            {statusLabel}
          </span>
        ) : undefined
      }
    >
      <style>{`.sig-editor:empty:before{content:attr(data-placeholder);color:#9ca3af;}`}</style>

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

      {error && <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p>}

      {/* Preview / editor */}
      {mode === "CUSTOM" ? (
        <CustomSignatureEditor
          initialHtml={customHtml ?? ""}
          onSaved={(html) => {
            setCustomHtml(html);
            setStatus("saved");
          }}
          onSaving={() => setStatus("saving")}
          onError={setError}
        />
      ) : (
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9ca3af", marginBottom: 8 }}>
            How your emails will sign off
          </p>
          <div
            style={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)", background: "#fff", padding: 16, overflowX: "auto" }}
            dangerouslySetInnerHTML={{ __html: previewHtml || "<span style='color:#9ca3af;font-size:13px'>Nothing to preview yet.</span>" }}
          />
        </div>
      )}
    </AccountCard>
  );
}

// Editable, paste-capable custom signature. Native paste (so Outlook/Gmail images
// come through), then auto-saves; the save hosts inline images + sanitises and
// returns clean HTML, which we re-inject after a paste so the editor shows the
// real result. Plain typing auto-saves without re-injecting (keeps the cursor).
function CustomSignatureEditor({
  initialHtml,
  onSaved,
  onSaving,
  onError,
}: {
  initialHtml: string;
  onSaved: (html: string) => void;
  onSaving: () => void;
  onError: (msg: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reinjectNext = useRef(false);
  const [empty, setEmpty] = useState(!initialHtml.trim());

  // Seed once.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(async () => {
    const html = ref.current?.innerHTML ?? "";
    const reinject = reinjectNext.current;
    reinjectNext.current = false;
    onSaving();
    onError("");
    const res = await saveSignatureAction({ mode: "CUSTOM", customHtml: html });
    if (!res.ok) {
      onError(res.error);
      return;
    }
    // After a paste, replace the raw clipboard HTML with the cleaned, image-
    // hosted result (Outlook markup can include contenteditable="false" regions
    // and a live selection; the clean re-inject makes it fully editable) and
    // clear the lingering selection so a click lands normally.
    if (reinject && ref.current) {
      ref.current.innerHTML = res.html ?? "";
      window.getSelection?.()?.removeAllRanges();
    }
    setEmpty(!(res.html ?? html).replace(/<[^>]*>/g, "").trim());
    onSaved(res.html ?? html);
  }, [onSaved, onSaving, onError]);

  function schedule(delay: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, delay);
  }

  function clearEditor() {
    if (ref.current) ref.current.innerHTML = "";
    reinjectNext.current = false;
    setEmpty(true);
    schedule(0);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9ca3af", margin: 0 }}>
          Your signature · click to edit
        </p>
        <button type="button" onClick={clearEditor} disabled={empty} style={{ ...secondaryBtn, padding: "5px 12px", opacity: empty ? 0.5 : 1 }}>
          <Trash size={14} weight="bold" /> Clear
        </button>
      </div>
      <div
        ref={ref}
        className="sig-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        data-placeholder="Paste JUST your signature here (Ctrl/Cmd+V), or type it. Tip: copy only the sign-off block, not a whole email."
        onPaste={() => { reinjectNext.current = true; schedule(500); }}
        onInput={() => { setEmpty(!(ref.current?.textContent ?? "").trim()); schedule(1000); }}
        onBlur={() => schedule(0)}
        style={{
          borderRadius: 10, border: "1px solid rgba(0,0,0,0.14)", background: "#fff",
          padding: 16, minHeight: 120, maxHeight: 340, overflowY: "auto", outline: "none",
          fontSize: 14, color: "#111827", lineHeight: 1.5, cursor: "text",
        }}
      />
      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6, lineHeight: 1.45 }}>
        Paste only your signature block, not a whole email. Click into the box to edit or delete anything you don&rsquo;t want. Changes save automatically, and pasted images are hosted so they show in inboxes.
      </p>
    </div>
  );
}

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600,
  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.16)",
  background: "#fff", color: "#374151", cursor: "pointer",
};
