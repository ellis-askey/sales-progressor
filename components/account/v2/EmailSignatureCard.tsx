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
import { saveSignatureAction, previewSignatureAction, applySignatureSourceAction, sendSignatureTestAction, saveSignOffAction, type SignatureTarget } from "@/app/actions/signature";
import type { SignatureSource } from "@/lib/email/signature-source";
import { SIGN_OFF_CHOICES, normalizeSignOff } from "@/lib/email/sign-off";
import { PenNib, UploadSimple, Link as LinkIcon, Trash, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";

export interface SignatureInitial {
  mode: EmailSignatureMode;
  imageUrl: string | null;
  customHtml: string | null;
  previewHtml: string;
  missing: string[];
  source: SignatureSource;
  // The saved default sign-off phrase (the valediction above the signature).
  signOff: string;
}

const SOURCE_OPTIONS: Array<{ value: SignatureSource; label: string }> = [
  { value: "other", label: "Standard" },
  { value: "outlook", label: "Outlook" },
  { value: "gmail", label: "Gmail" },
  { value: "wisestamp", label: "WiseStamp" },
  { value: "exclaimer", label: "Exclaimer" },
];

const MODES: Array<{ value: EmailSignatureMode; label: string; blurb: string }> = [
  { value: "BASIC", label: "Basic", blurb: "Created automatically from your details." },
  { value: "IMAGE", label: "Signature image", blurb: "Use an image of your existing signature." },
  { value: "CUSTOM", label: "Custom", blurb: "Paste the signature you already use." },
];

type Status = "idle" | "saving" | "saved";

export function EmailSignatureCard({
  initial,
  target,
  title = "Email signature",
  subtitle = "How your emails sign off. This applies to chases and any email you send from Sales Progressor.",
}: {
  initial: SignatureInitial;
  // Present => this card edits a client agency's per-client sign-off (Clients
  // page) instead of the signed-in user's own signature. Absent => per-user.
  target?: SignatureTarget;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const { toast } = useAgentToast();
  // The image route targets the client link when an agencyId is present.
  const imgQuery = target?.kind === "client" ? `?agencyId=${encodeURIComponent(target.agencyId)}` : "";

  const [mode, setMode] = useState<EmailSignatureMode>(initial.mode);
  const [signOff, setSignOff] = useState<string>(normalizeSignOff(initial.signOff));
  const [imageUrl, setImageUrl] = useState<string | null>(initial.imageUrl);
  const [customHtml, setCustomHtml] = useState<string | null>(initial.customHtml);
  const [previewHtml, setPreviewHtml] = useState<string>(initial.previewHtml);
  const [missing, setMissing] = useState<string[]>(initial.missing);

  const [status, setStatus] = useState<Status>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshPreview = useCallback(async (m: EmailSignatureMode, html: string | null) => {
    try {
      const res = await previewSignatureAction({ mode: m, customHtml: html, target });
      setPreviewHtml(res.html);
      setMissing(res.missing);
    } catch {
      /* keep last good preview */
    }
  }, [target]);

  async function selectMode(m: EmailSignatureMode) {
    setMode(m);
    setError("");
    setStatus("saving");
    const res = await saveSignatureAction({ mode: m, customHtml, target });
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
      if (target?.kind === "client") body.append("agencyId", target.agencyId);
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
        body: JSON.stringify({ url: urlValue.trim(), ...(target?.kind === "client" ? { agencyId: target.agencyId } : {}) }),
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
      const res = await fetch(`/api/agent/signature-image${imgQuery}`, { method: "DELETE" });
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

  async function chooseSignOff(next: string) {
    const phrase = normalizeSignOff(next);
    setSignOff(phrase);
    setError("");
    setStatus("saving");
    const res = await saveSignOffAction(phrase, target);
    setStatus(res.ok ? "saved" : "idle");
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  async function sendTest() {
    setSending(true);
    setError("");
    try {
      const res = await sendSignatureTestAction(target);
      if (res.ok) toast.success("Test email sent. Check your inbox.");
      else setError(res.error);
    } catch {
      setError("Couldn't send the test email just now.");
    } finally {
      setSending(false);
    }
  }

  const statusLabel = status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "";

  // Primary "Send test" action — sends the signed-in user a real email built from
  // their current signature so they can see how it lands before trusting it live.
  // Lives on the right of the actions/header row in every mode.
  const testBtn = (
    <button
      type="button"
      onClick={sendTest}
      disabled={sending || busy}
      className="sig-test-btn"
      style={{ ...primaryBtn, opacity: sending ? 0.75 : 1 }}
      title="Send yourself a test email to see how your signature looks"
    >
      <PaperPlaneTilt size={15} weight="bold" /> {sending ? "Sending…" : "Send test"}
    </button>
  );

  return (
    <AccountCard
      icon={<PenNib size={18} weight="bold" />}
      title={title}
      subtitle={subtitle}
      headerAction={
        statusLabel ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: status === "saving" ? "#9ca3af" : "#059669" }}>
            {statusLabel}
          </span>
        ) : undefined
      }
    >
      <style>{`
        .sig-editor:empty:before{content:attr(data-placeholder);color:#9ca3af;}
        .sig-mode-btn{transition:background 160ms,border-color 150ms,box-shadow 220ms,transform 160ms;outline:none;}
        .sig-mode-btn:not(.on):hover{border-color:var(--agent-coral,#FF8A65);transform:translateY(-1px);}
        /* Coral keyboard focus instead of the browser's black outline. */
        .sig-mode-btn:focus-visible{outline:2px solid var(--agent-coral,#FF6B4A);outline-offset:2px;}
        /* Destructive buttons (Remove, Clear): the bin + button go red on hover.
           !important beats the inline base style. */
        .sig-danger-btn{transition:background 140ms,border-color 140ms,color 140ms,transform 90ms;}
        .sig-danger-btn:hover:not(:disabled){background:#fef2f2 !important;border-color:#dc2626 !important;color:#dc2626 !important;}
        .sig-danger-btn:active:not(:disabled){transform:scale(0.97);}
        .sig-test-btn{transition:filter 140ms,transform 120ms,box-shadow 180ms;}
        .sig-test-btn:hover:not(:disabled){filter:brightness(1.04);transform:translateY(-1px);}
        .sig-test-btn:active:not(:disabled){transform:scale(0.98);}
        .sig-test-btn:focus-visible{outline:2px solid var(--agent-coral,#FF6B4A);outline-offset:2px;}
        .sig-test-btn:disabled{cursor:default;}
      `}</style>

      {/* Sign-off phrase — the valediction that heads every email the user
          composes (New email + chase), sitting above the signature below. Owned
          by the app and set here, so it's never baked into the signature itself.
          Editable per email at send time; this is the saved default. */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 18, padding: "13px 15px", borderRadius: 12, border: "1px solid var(--agent-border-default, rgba(0,0,0,0.12))", background: "var(--agent-surface-glass, #fafafa)" }}>
        <label htmlFor="sig-signoff" style={{ flex: "1 1 190px", minWidth: 0, cursor: "pointer" }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#111827" }}>Sign-off</span>
          <span style={{ display: "block", fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            Starts the emails you send, above your signature. No need to add it to the signature below.
          </span>
        </label>
        <select
          id="sig-signoff"
          value={signOff}
          onChange={(e) => chooseSignOff(e.target.value)}
          className="account-input"
          style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: "#111827", padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.16)", background: "#fff", outline: "none", cursor: "pointer" }}
        >
          {SIGN_OFF_CHOICES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Mode selector — standard option-select treatment: brand-fill + tick on
          the chosen one, clean outline otherwise. Follows the agency colour. */}
      <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
        {MODES.map((m) => {
          const active = mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => selectMode(m.value)}
              className={`sig-mode-btn${active ? " on" : ""}`}
              style={{
                textAlign: "left", cursor: "pointer", borderRadius: 12, padding: "13px 15px",
                border: active ? "1.5px solid transparent" : "1.5px solid var(--agent-border-default, rgba(0,0,0,0.14))",
                background: active ? "linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))" : "#fff",
                boxShadow: active ? "0 4px 13px -2px rgba(var(--agent-coral-rgb), 0.45), inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: active ? "var(--agent-text-on-coral, #fff)" : "#111827" }}>{m.label}</span>
                <span style={{ display: "block", fontSize: 13, color: active ? "rgba(255,255,255,0.88)" : "#6b7280" }}>{m.blurb}</span>
              </span>
              {active && <CheckCircle size={20} weight="fill" color="var(--agent-text-on-coral, #fff)" style={{ flexShrink: 0 }} />}
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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="account-btn-secondary" style={secondaryBtn}>
              <UploadSimple size={15} weight="bold" /> {imageUrl ? "Replace image" : "Upload image"}
            </button>
            {imageUrl && (
              <button type="button" onClick={removeImage} disabled={busy} className="sig-danger-btn" style={secondaryBtn}>
                <Trash size={15} weight="bold" /> Remove
              </button>
            )}
            <span style={{ marginLeft: "auto" }}>{testBtn}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <LinkIcon size={15} weight="bold" style={{ color: "#6b7280", flexShrink: 0 }} />
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="…or paste an https image URL"
              className="account-input"
              style={{ flex: 1, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.14)", outline: "none" }}
            />
            <button type="button" onClick={importUrl} disabled={busy || !urlValue.trim()} className="account-btn-secondary" style={secondaryBtn}>
              Import
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p>}

      {/* Preview / editor */}
      {mode === "CUSTOM" ? (
        <>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>{testBtn}</div>
        <CustomSignatureEditor
          target={target}
          initialHtml={customHtml ?? ""}
          initialSource={initial.source}
          onSaved={(html) => {
            setCustomHtml(html);
            setStatus("saved");
          }}
          onSaving={() => setStatus("saving")}
          onError={(msg) => { setError(msg); if (msg) setStatus("idle"); }}
        />
        </>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9ca3af", margin: 0 }}>
              How your emails will sign off
            </p>
            {mode === "BASIC" && testBtn}
          </div>
          <div
            className="sig-signature-preview"
            style={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)", background: "#fff", padding: 16, overflowX: "auto" }}
            dangerouslySetInnerHTML={{
              __html: previewHtml
                // BASIC carries no sign-off of its own, so show the chosen phrase
                // above it exactly as the email will read. An IMAGE signature
                // already carries its own valediction, so it's left to stand alone.
                ? (mode === "BASIC"
                    ? `<p style="margin:0 0 10px;font-size:14px;color:#111827;line-height:1.5;">${signOff}</p>${previewHtml}`
                    : previewHtml)
                : "<span style='color:#9ca3af;font-size:13px'>Nothing to preview yet.</span>",
            }}
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
  target,
  initialHtml,
  initialSource,
  onSaved,
  onSaving,
  onError,
}: {
  target?: SignatureTarget;
  initialHtml: string;
  initialSource: SignatureSource;
  onSaved: (html: string) => void;
  onSaving: () => void;
  onError: (msg: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reinjectNext = useRef(false);
  const [empty, setEmpty] = useState(!initialHtml.trim());
  const [source, setSource] = useState<SignatureSource>(initialSource);

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
    const res = await saveSignatureAction({ mode: "CUSTOM", customHtml: html, target });
    if (!res.ok) {
      onError(res.error);
      return;
    }
    if (res.source) setSource(res.source);
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
  }, [onSaved, onSaving, onError, target]);

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

  async function changeSource(next: SignatureSource) {
    const prev = source;
    setSource(next);
    onSaving();
    onError("");
    const res = await applySignatureSourceAction(next, target);
    if (!res.ok) {
      setSource(prev);
      onError(res.error);
      return;
    }
    if (ref.current) ref.current.innerHTML = res.html ?? "";
    onSaved(res.html ?? "");
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9ca3af", margin: 0 }}>
          Your signature · click to edit
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!empty && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9ca3af" }}>
              Pasted from
              <select
                value={source}
                onChange={(e) => changeSource(e.target.value as SignatureSource)}
                className="account-input"
                style={{ fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.16)", background: "#fff", color: "#374151", outline: "none" }}
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={clearEditor} disabled={empty} className="sig-danger-btn" style={{ ...secondaryBtn, padding: "5px 12px", opacity: empty ? 0.5 : 1 }}>
            <Trash size={14} weight="bold" /> Clear
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="sig-editor account-input"
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
        Paste just your signature block, not the whole email. Click inside the box to edit or remove anything you don&rsquo;t want. Changes save as you make them, and pasted images are hosted so they display properly in inboxes.
      </p>
    </div>
  );
}

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600,
  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.16)",
  background: "#fff", color: "#374151", cursor: "pointer",
};

// Primary action — coral fill following the agency colour, matching the chosen
// mode card. Used by "Send test".
const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700,
  padding: "8px 16px", borderRadius: 8, border: "1.5px solid transparent",
  background: "linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))",
  color: "var(--agent-text-on-coral, #fff)", cursor: "pointer", whiteSpace: "nowrap",
  boxShadow: "0 4px 13px -2px rgba(var(--agent-coral-rgb), 0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
};
