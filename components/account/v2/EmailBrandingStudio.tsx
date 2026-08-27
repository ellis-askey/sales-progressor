"use client";

// Director-only: upload the agency logo and adjust how it presents at the top
// of client emails. The preview renders the SAME band the emails send (Option B
// — the logo's colour fills a full-width band above the coral hero), driven by
// the shared measurements in lib/email/logo-header.ts so it can't drift.

import { useMemo, useRef, useState } from "react";
import {
  LOGO_HEIGHTS,
  LOGO_BAND_PADDING_Y,
  LOGO_BAND_PADDING_X,
  LOGO_MAX_WIDTH,
} from "@/lib/email/logo-header";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif";
const ALLOWED = new Set(ACCEPT.split(","));
const WHITE = "#ffffff";
const DARK = "#12233b";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface BrandingInitial {
  logoUrl: string | null;
  tileColor: string | null;
  scale: LogoScale | null;
  align: LogoAlign | null;
}

// `endpoint` is the base URL for the logo API (POST upload / PATCH adjust /
// DELETE). Defaults to the director's own route; the Command Centre passes its
// superadmin route (/api/command/agencies/{agencyId}/logo) to manage an
// agency's branding on their behalf. Same component, same live preview.
export function EmailBrandingStudio({
  initial,
  endpoint = "/api/agent/agency-logo",
}: {
  initial: BrandingInitial;
  endpoint?: string;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [autoColor, setAutoColor] = useState(initial.tileColor ?? WHITE);
  const [tileColor, setTileColor] = useState(initial.tileColor ?? WHITE);
  const [scale, setScale] = useState<LogoScale>(initial.scale ?? "md");
  const [align, setAlign] = useState<LogoAlign>(initial.align ?? "left");
  const [saved, setSaved] = useState({
    tileColor: initial.tileColor ?? WHITE,
    scale: initial.scale ?? ("md" as LogoScale),
    align: initial.align ?? ("left" as LogoAlign),
  });
  const [busy, setBusy] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shownLogo = localPreview ?? logoUrl;
  const dirty = useMemo(
    () => tileColor !== saved.tileColor || scale !== saved.scale || align !== saved.align,
    [tileColor, scale, align, saved],
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    if (!ALLOWED.has(file.type)) { setError("Please choose a PNG, JPG, WebP or SVG."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Logo must be under 2MB."); return; }

    setLocalPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataBase64, mimetype: file.type }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Upload failed. Try again."); setLocalPreview(null); return; }
      setLogoUrl(`${json.url}?t=${Date.now()}`);
      setLocalPreview(null);
      setAutoColor(json.tileColor);
      setTileColor(json.tileColor);
      setScale(json.scale);
      setAlign(json.align);
      setSaved({ tileColor: json.tileColor, scale: json.scale, align: json.align });
      setSavingState("saved");
    } catch {
      setError("Upload failed. Try again.");
      setLocalPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    setSavingState("saving");
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tileColor, scale, align }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Couldn't save your changes.");
        setSavingState("idle");
        return;
      }
      setSaved({ tileColor, scale, align });
      setSavingState("saved");
    } catch {
      setError("Couldn't save your changes.");
      setSavingState("idle");
    }
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Couldn't remove the logo."); return; }
      setLogoUrl(null);
      setLocalPreview(null);
      setTileColor(WHITE);
      setAutoColor(WHITE);
      setScale("md");
      setAlign("left");
      setSaved({ tileColor: WHITE, scale: "md", align: "left" });
      setSavingState("idle");
    } finally {
      setBusy(false);
    }
  }

  const swatches: Array<{ key: string; label: string; color: string }> = [
    { key: "auto", label: "Auto", color: autoColor },
    { key: "white", label: "White", color: WHITE },
    { key: "dark", label: "Dark", color: DARK },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Live preview: the real top of a client email */}
      <div>
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.10)", borderRadius: 16, overflow: "hidden",
            maxWidth: 460, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {shownLogo && (
            <div
              style={{
                background: tileColor,
                padding: `${LOGO_BAND_PADDING_Y[scale]}px ${LOGO_BAND_PADDING_X}px`,
                textAlign: align === "center" ? "center" : "left",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shownLogo}
                alt="Agency logo"
                style={{
                  height: LOGO_HEIGHTS[scale], maxWidth: LOGO_MAX_WIDTH, objectFit: "contain",
                  display: align === "center" ? "inline-block" : "block", opacity: busy ? 0.5 : 1,
                }}
              />
            </div>
          )}
          <div style={{ background: "linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%)", padding: "22px 28px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)" }}>
              14 Maple Grove, Harborne
            </p>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
              Mortgage offer received
            </h1>
          </div>
        </div>
        <p style={{ margin: "8px 2px 0", fontSize: 12, color: "#9ca3af" }}>
          A live preview of the top of the emails your clients receive.
        </p>
      </div>

      {/* Upload / replace / remove */}
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
          {busy ? "Working…" : logoUrl ? "Replace logo" : "Upload logo"}
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

      {/* Adjustment tools — only meaningful once there's a logo */}
      {logoUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
          {/* Background colour */}
          <Control label="Background">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {swatches.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { setTileColor(s.color); setSavingState("idle"); }}
                  aria-pressed={tileColor.toLowerCase() === s.color.toLowerCase()}
                  title={s.label}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 10px 5px 6px",
                    borderRadius: 999, cursor: "pointer",
                    border: tileColor.toLowerCase() === s.color.toLowerCase() ? "2px solid #111827" : "1px solid rgba(0,0,0,0.14)",
                    background: "#fff", fontSize: 12, fontWeight: 600, color: "#374151",
                  }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: s.color, border: "1px solid rgba(0,0,0,0.12)" }} />
                  {s.label}
                </button>
              ))}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(tileColor) ? tileColor : "#ffffff"}
                  onChange={(e) => { setTileColor(e.target.value); setSavingState("idle"); }}
                  style={{ width: 26, height: 26, padding: 0, border: "1px solid rgba(0,0,0,0.14)", borderRadius: 6, background: "none", cursor: "pointer" }}
                />
                Custom
              </label>
            </div>
          </Control>

          {/* Size */}
          <Control label="Size">
            <Segmented
              value={scale}
              onChange={(v) => { setScale(v as LogoScale); setSavingState("idle"); }}
              options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]}
            />
          </Control>

          {/* Alignment */}
          <Control label="Alignment">
            <Segmented
              value={align}
              onChange={(v) => { setAlign(v as LogoAlign); setSavingState("idle"); }}
              options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }]}
            />
          </Control>

          <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 2 }}>
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || savingState === "saving"}
              style={{
                fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: 8, border: "none",
                background: !dirty ? "rgba(0,0,0,0.08)" : "#FF6B4A", color: !dirty ? "#9ca3af" : "#fff",
                cursor: !dirty || savingState === "saving" ? "default" : "pointer",
              }}
            >
              {savingState === "saving" ? "Saving…" : "Save changes"}
            </button>
            {!dirty && savingState === "saved" && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>Saved</span>
            )}
            {dirty && (
              <button
                type="button"
                onClick={() => { setTileColor(autoColor); setSavingState("idle"); }}
                style={{ fontSize: 12, fontWeight: 500, background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0 }}
              >
                Reset colour to auto
              </button>
            )}
          </div>
        </div>
      )}

      <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
        We detect your logo&apos;s background automatically. Adjust the colour, size and alignment until it looks right. If you don&apos;t add a logo, your emails show your agency name instead.
      </p>
      {error && <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }} role="alert">{error}</p>}
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div style={{ display: "inline-flex", border: "1px solid rgba(0,0,0,0.14)", borderRadius: 8, overflow: "hidden", width: "fit-content" }}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            style={{
              fontSize: 13, fontWeight: 600, padding: "7px 16px", cursor: "pointer", border: "none",
              borderLeft: i === 0 ? "none" : "1px solid rgba(0,0,0,0.10)",
              background: active ? "#111827" : "#fff", color: active ? "#fff" : "#374151",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
