"use client";

// components/account/v2/AgencyNameForm.tsx
//
// Director-only editor for the agency's identity: logo + name. The logo is the
// SAME Agency.logoPath the client emails use (lib/email/agency-logo-band.ts) —
// this card is a second, friendlier doorway to it, so setting it here sets it on
// emails too. Finer placement (background, size, alignment) stays in the Email
// branding studio. Logo upload/remove posts to /api/agent/agency-logo (the same
// endpoint the studio uses); the name save is the existing updateAgencyNameAction.
//
// The header uses a container query (not a viewport one) so the title/subtitle/
// Save button never squish when the card itself is narrow — scoped to this card,
// the shared AccountCard is untouched.

import { useRef, useState } from "react";
import { Buildings, ImageSquare, PencilSimple } from "@phosphor-icons/react";
import { updateAgencyNameAction } from "@/app/actions/agency";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { titleCaseKeepAcronyms } from "@/lib/utils";

const CORAL_DEEP = "#E2452A";
const CORAL_TINT = "#FFF1EC";

// Read a File as raw base64 (no data: prefix), matching the agency-logo endpoint.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

export function AgencyNameForm({
  initialName,
  initialLogoUrl = null,
  initialTileColor = null,
}: {
  initialName: string;
  initialLogoUrl?: string | null;
  initialTileColor?: string | null;
}) {
  const { toast } = useAgentToast();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Logo state ──
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [tileColor, setTileColor] = useState<string | null>(initialTileColor);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shownLogo = localPreview ?? logoUrl;

  const dirty = name.trim() !== initialName.trim();
  const valid = name.trim().length > 0;

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      const res = await updateAgencyNameAction({ name: name.trim() });
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success("Agency name updated");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Logo must be under 2MB."); return; }
    setError("");
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => setLocalPreview(String(reader.result));
    reader.readAsDataURL(file);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch("/api/agent/agency-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataBase64, mimetype: file.type }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Upload failed. Try again."); setLocalPreview(null); return; }
      setLogoUrl(json.url ? `${json.url}?t=${Date.now()}` : null);
      if (json.tileColor) setTileColor(json.tileColor);
      setLocalPreview(null);
      toast.success("Logo updated");
    } catch {
      setError("Upload failed. Try again.");
      setLocalPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/agent/agency-logo", { method: "DELETE" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Couldn't remove the logo."); return; }
      setLogoUrl(null);
      setLocalPreview(null);
      toast.success("Logo removed");
    } catch {
      setError("Couldn't remove the logo.");
    } finally {
      setBusy(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 13.5,
    color: "#111827",
    background: "#fff",
    border: "0.5px solid rgba(0,0,0,0.16)",
    borderRadius: 8,
    outline: "none",
    transition: "border-color 120ms, box-shadow 120ms",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: 500,
    marginBottom: 5,
  };

  return (
    <div className="agency-details-reflow">
      <AccountCard
        icon={<Buildings size={18} weight="bold" />}
        title="Agency details"
        subtitle="The name and logo shown across Sales Progressor and in client communications."
        headerAction={
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty || !valid}
            className="account-btn-primary"
            style={{ padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: saving || !dirty || !valid ? "default" : "pointer" }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        }
      >
        {/* Logo — shown as the brand band clients see at the top of emails. */}
        <label style={labelStyle}>Logo</label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          disabled={busy}
          aria-label={shownLogo ? "Replace logo" : "Add logo"}
          style={{
            position: "relative",
            width: "100%",
            height: 88,
            borderRadius: 12,
            overflow: "hidden",
            cursor: busy ? "default" : "pointer",
            padding: 0,
            display: "block",
            border: shownLogo ? "none" : "1.5px dashed rgba(0,0,0,0.18)",
            background: shownLogo ? (tileColor || "#111827") : "#f7f5f3",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {shownLogo ? (
            <>
              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 24 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shownLogo} alt="Agency logo" style={{ maxHeight: 48, maxWidth: "70%", objectFit: "contain" }} />
              </span>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(8,12,20,0.46)",
                  opacity: hover && !busy ? 1 : 0,
                  transition: "opacity 140ms",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <PencilSimple size={15} weight="bold" /> Replace logo
              </span>
            </>
          ) : (
            <span style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "#6b7280" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", background: CORAL_TINT, color: CORAL_DEEP, marginBottom: 2 }}>
                <ImageSquare size={16} weight="bold" />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>Add your logo</span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>Shown at the top of every client email</span>
            </span>
          )}
        </button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" onChange={onFile} style={{ display: "none" }} />
        {shownLogo && !busy && (
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={handleRemove} style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, fontWeight: 600, color: "#9ca3af", cursor: "pointer", letterSpacing: 0.2 }}>
              Remove
            </button>
          </div>
        )}

        {/* Name */}
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Agency name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => { if (e.target.value.trim()) setName(titleCaseKeepAcronyms(e.target.value)); }}
            placeholder="e.g. Hartwell & Partners"
            autoComplete="organization"
            className="account-input"
            style={fieldStyle}
          />
        </div>
        {error && <p style={{ fontSize: 12.5, color: "#dc2626", margin: "10px 0 0" }}>{error}</p>}
      </AccountCard>
      <style>{`
        .agency-details-reflow { container-type: inline-size; }
        /* Reflow by the card's OWN width: once it's narrow, the subtitle drops to
           its own full-width row so the title + Save button never squish it. */
        @container (max-width: 440px) {
          .agency-details-reflow .account-card-head { grid-template-areas: "ico title action" "sub sub sub"; row-gap: 8px; }
        }
      `}</style>
    </div>
  );
}
